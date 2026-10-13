import type {Database,SqlJsStatic} from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {canonicalJson,validateScope,validateOperation,pendingOperation,type JsonObject,type OperationScope,type Operation,type OperationRecord,type OperationStore} from '@onebite/core/operations';
export type OperationalWorkspace={schema:1;revision:number;state:JsonObject;operations:OperationRecord[]};
const name='onebite-operations-v1';
let engine:Promise<SqlJsStatic>|undefined,queue=Promise.resolve();
function serial<T>(action:()=>Promise<T>){const next=queue.then(()=>navigator.locks?navigator.locks.request(name,action):action());queue=next.then(()=>{},()=>{});return next;}
async function storage(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('files');r.result.createObjectStore('keys');r.result.createObjectStore('meta');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function get<T>(db:IDBDatabase,store:string,id:string){return new Promise<T|undefined>((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
/** First writer wins, including browsers without Web Locks. Never replace an existing actor key. */
async function getOrCreate<T>(db:IDBDatabase,store:string,id:string,value:T){return new Promise<T>((resolve,reject)=>{const tx=db.transaction(store,'readwrite'),object=tx.objectStore(store),r=object.get(id);let result:T;r.onsuccess=()=>{try{result=r.result??value;if(r.result===undefined)object.put(value,id);}catch{tx.abort();}};tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(tx.error);});}
async function persist(store:IDBDatabase,expected:number,bytes:Uint8Array){return new Promise<void>((resolve,reject)=>{
 const tx=store.transaction('files','readwrite'),files=tx.objectStore('files'),r=files.get('sqlite');let stale=false;
 r.onsuccess=()=>{try{if((r.result?.revision??0)!==expected){stale=true;tx.abort();return;}files.put({revision:expected+1,bytes},'sqlite');}catch{tx.abort();}};tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new Error(stale?'stale_operation_state':'storage_failed'));
});}
async function database<T>(action:(db:Database,store:IDBDatabase)=>Promise<T>,write:boolean){
 const store=await storage();let db:Database|undefined;
 try{const snapshot=await get<{revision:number;bytes:Uint8Array}>(store,'files','sqlite');engine??=import('sql.js').then(({default:init})=>init({locateFile:()=>wasmUrl}));db=new (await engine).Database(snapshot?.bytes);
  db.run('CREATE TABLE IF NOT EXISTS workspaces (scope TEXT PRIMARY KEY,value TEXT NOT NULL)');db.run('CREATE TABLE IF NOT EXISTS operation_ids (id TEXT PRIMARY KEY,scope TEXT NOT NULL)');
  const result=await action(db,store);if(write)await persist(store,snapshot?.revision??0,db.export());return result;
 }finally{db?.close();store.close();}
}
const scopeKey=(scope:OperationScope)=>canonicalJson({actorId:scope.actorId,siteId:scope.siteId,deviceId:scope.deviceId});
async function actorKey(store:IDBDatabase,actor:string){const existing=await get<CryptoKey>(store,'keys',actor);return existing??getOrCreate(store,'keys',actor,await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']));}
const encode=(bytes:Uint8Array)=>{let binary='';for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));return btoa(binary);};
const decode=(value:string)=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
async function encrypt(workspace:OperationalWorkspace,key:CryptoKey,scope:string){const plaintext=new TextEncoder().encode(canonicalJson(workspace));if(plaintext.length>8_000_000)throw new Error('operation_capacity');const iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(scope)},key,plaintext);return JSON.stringify({iv:encode(iv),data:encode(new Uint8Array(data))});}
async function read(db:Database,store:IDBDatabase,scope:OperationScope,prefix=''):Promise<OperationalWorkspace>{
 const id=prefix+scopeKey(scope),statement=db.prepare('SELECT value FROM workspaces WHERE scope=?');
 try{statement.bind([id]);if(!statement.step())return {schema:1,revision:0,state:{},operations:[]};const raw=JSON.parse(String(statement.getAsObject().value)),bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(raw.iv),additionalData:new TextEncoder().encode(id)},await actorKey(store,scope.actorId),decode(raw.data));const workspace=JSON.parse(new TextDecoder().decode(bytes));if(workspace.schema!==1||!Number.isSafeInteger(workspace.revision)||workspace.revision<0||!Array.isArray(workspace.operations))throw new Error('invalid_operation_state');return workspace;
 }finally{statement.free();}
}
async function write(db:Database,store:IDBDatabase,scope:OperationScope,workspace:OperationalWorkspace,prefix=''){const id=prefix+scopeKey(scope),value=await encrypt(workspace,await actorKey(store,scope.actorId),id);db.run('INSERT INTO workspaces VALUES (?,?) ON CONFLICT(scope) DO UPDATE SET value=excluded.value',[id,value]);}
export async function operationalDeviceId(){const store=await storage();try{return await getOrCreate(store,'meta','device',crypto.randomUUID());}finally{store.close();}}
export function loadOperationalWorkspace(scope:OperationScope){scope={...scope};validateScope(scope);return serial(()=>database((db,store)=>read(db,store,scope),false));}
/** Projection and immutable operation share one durable SQLite snapshot. Never acknowledge before IDB commits. */
export async function commitOperationalChange(scope:OperationScope,expectedRevision:number,state:JsonObject,operation:Operation){
 scope={...scope};validateScope(scope);const sealed:Operation=JSON.parse(canonicalJson(operation));const projection=JSON.parse(canonicalJson(state));if(!projection||Array.isArray(projection)||typeof projection!=='object'||new TextEncoder().encode(canonicalJson(projection)).length>1_000_000)throw new Error('invalid_projection');await validateOperation(sealed,scope);
 // Freeze inputs before any queued asynchronous work so caller mutation cannot alter the saved envelope.
 return serial(()=>database(async(db,store)=>{
  const current=await read(db,store,scope),existing=current.operations.find(r=>r.operation.id===sealed.id);
  if(existing){if(existing.operation.fingerprint!==sealed.fingerprint)throw new Error('operation_conflict');return current;}
  if(current.revision!==expectedRevision)throw new Error('stale_operation_state');
  if(current.operations.length>=1000)throw new Error('operation_capacity');
  if(sealed.dependencies.some(id=>!current.operations.some(r=>r.operation.id===id)))throw new Error('unknown_dependency');
  const claim=db.prepare('SELECT scope FROM operation_ids WHERE id=?');try{claim.bind([sealed.id]);if(claim.step())throw new Error('operation_conflict');}finally{claim.free();}
  db.run('INSERT INTO operation_ids VALUES (?,?)',[sealed.id,scopeKey(scope)]);
  const next:OperationalWorkspace={schema:1,revision:current.revision+1,state:projection,operations:[...current.operations,pendingOperation(sealed)]};await write(db,store,scope,next);return next;
 },true));
}
async function updateOperation(scope:OperationScope,id:string,revision:number,change:(record:OperationRecord)=>OperationRecord){
 scope={...scope};validateScope(scope);return serial(()=>database(async(db,store)=>{
  const current=await read(db,store,scope),record=current.operations.find(r=>r.operation.id===id);if(!record)throw new Error('operation_not_found');if(record.revision!==revision)throw new Error('stale_operation_state');
  const changed:OperationRecord=JSON.parse(canonicalJson(change(JSON.parse(canonicalJson(record)))));
  if(canonicalJson(changed.operation)!==canonicalJson(record.operation))throw new Error('operation_conflict');
  const sending=(record.status==='pending'||record.status==='sending')&&changed.status==='sending';
  const completing=record.status==='sending'&&['pending','review','acknowledged'].includes(changed.status);
  if(!sending&&!completing||changed.attempts!==record.attempts+(sending?1:0)||changed.revision!==record.revision||!Number.isSafeInteger(changed.retryAt)||changed.retryAt<0||changed.lastError!==null&&!/^[a-z_]{1,60}$/.test(changed.lastError))throw new Error('invalid_operation_transition');
  if(changed.status==='acknowledged'&&(!changed.receipt||changed.receipt.id!==id||changed.receipt.fingerprint!==record.operation.fingerprint||typeof changed.receipt.reference!=='string'||!changed.receipt.reference.trim()||changed.receipt.reference.length>200||!Number.isFinite(Date.parse(changed.receipt.acknowledgedAt))))throw new Error('invalid_receipt');
  if(changed.status!=='acknowledged'&&changed.receipt!==null)throw new Error('invalid_receipt');
  const nextRecord={...changed,revision:record.revision+1};await write(db,store,scope,{...current,revision:current.revision+1,operations:current.operations.map(r=>r===record?nextRecord:r)});return nextRecord;
 },true));
}
export const operationalStore:OperationStore={list:async scope=>(await loadOperationalWorkspace(scope)).operations,update:updateOperation};

/** Downloaded cache is separate from local business projections and immutable queued events. */
export function loadOperationalCache(scope:OperationScope){scope={...scope};validateScope(scope);return serial(()=>database(async(db,store)=>(await read(db,store,scope,'cache:')).state,false));}
export function saveOperationalCache(scope:OperationScope,state:JsonObject){scope={...scope};validateScope(scope);const sealed=JSON.parse(canonicalJson(state));return serial(()=>database(async(db,store)=>write(db,store,scope,{schema:1,revision:0,state:sealed,operations:[]},'cache:'),true));}
