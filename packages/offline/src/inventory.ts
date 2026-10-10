import type {Database,SqlJsStatic} from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type {CatalogOperation} from '@onebite/core/inventory';
const databaseName='onebite-inventory-v1';
let engine:Promise<SqlJsStatic>|undefined,queue=Promise.resolve();
function serial<T>(action:()=>Promise<T>):Promise<T>{const next=queue.then(()=>navigator.locks?navigator.locks.request(databaseName,action):action());queue=next.then(()=>{},()=>{});return next;}
async function storage(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>{request.result.createObjectStore('files');request.result.createObjectStore('keys');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function get<T>(db:IDBDatabase,store:string,id:string){return new Promise<T|undefined>((resolve,reject)=>{const request=db.transaction(store).objectStore(store).get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function put(db:IDBDatabase,store:string,id:string,value:unknown){return new Promise<void>((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function database<T>(action:(db:Database,storage:IDBDatabase)=>Promise<T>,write:boolean){
 const store=await storage();let db:Database|undefined;
 try{engine??=import('sql.js').then(({default:init})=>init({locateFile:()=>wasmUrl}));db=new (await engine).Database(await get<Uint8Array>(store,'files','sqlite'));
  db.run('CREATE TABLE IF NOT EXISTS cache (scope TEXT PRIMARY KEY, value TEXT NOT NULL)');
  db.run('CREATE TABLE IF NOT EXISTS outbox (actor TEXT NOT NULL, id TEXT NOT NULL, item TEXT NOT NULL, value TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(actor,id), UNIQUE(actor,item))');
  const result=await action(db,store);if(write)await put(store,'files','sqlite',db.export());return result;
 }finally{db?.close();store.close();}
}
async function tokenKey(token:string){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode('onebite-inventory:'+token)),'AES-GCM',false,['encrypt','decrypt']);}
async function actorKey(store:IDBDatabase,actor:string){let key=await get<CryptoKey>(store,'keys',actor);if(!key){key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await put(store,'keys',actor,key);}return key;}
const bytes=(value:string)=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
const encode=(value:Uint8Array)=>btoa(Array.from(value,byte=>String.fromCharCode(byte)).join(''));
async function encrypt(value:unknown,key:CryptoKey,scope:string){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(scope)},key,new TextEncoder().encode(JSON.stringify(value)));return JSON.stringify({iv:encode(iv),data:encode(new Uint8Array(data))});}
async function decrypt<T>(value:string,key:CryptoKey,scope:string):Promise<T>{const envelope=JSON.parse(value);const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:new TextEncoder().encode(scope)},key,bytes(envelope.data));return JSON.parse(new TextDecoder().decode(data));}
async function scope(token:string){return encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))));}
/** Session-bound cached authorization; offline work is limited to 24 hours. */
export async function saveCatalogCache<T>(token:string,data:T){const id=await scope(token),value=await encrypt({data,verifiedAt:Date.now()},await tokenKey(token),id);return serial(()=>database(async db=>{db.run('INSERT INTO cache VALUES (?,?) ON CONFLICT(scope) DO UPDATE SET value=excluded.value',[id,value]);},true));}
export async function loadCatalogCache<T>(token:string):Promise<{data:T;verifiedAt:number}|null>{
 const id=await scope(token);return serial(()=>database(async db=>{const statement=db.prepare('SELECT value FROM cache WHERE scope=?');try{statement.bind([id]);if(!statement.step())return null;const value=await decrypt<{data:T;verifiedAt:number}>(String(statement.getAsObject().value),await tokenKey(token),id);return value.verifiedAt<=Date.now()&&Date.now()-value.verifiedAt<24*60*60_000?value:null;}catch{return null;}finally{statement.free();}},false));
}
export async function inventoryOutbox(actor:string):Promise<CatalogOperation[]>{return serial(()=>database(async(db,store)=>{const statement=db.prepare('SELECT id,value FROM outbox WHERE actor=? ORDER BY created_at,id');try{statement.bind([actor]);const result:CatalogOperation[]=[];while(statement.step()){const row=statement.getAsObject();result.push(await decrypt<CatalogOperation>(String(row.value),await actorKey(store,actor),actor+':'+row.id));}return result;}finally{statement.free();}},false));}
/** A queued operation never changes after transmission; one pending edit per item. */
export async function queueCatalogOperation(actor:string,operation:CatalogOperation){return serial(()=>database(async(db,store)=>{const value=await encrypt(operation,await actorKey(store,actor),actor+':'+operation.id);db.run('INSERT INTO outbox VALUES (?,?,?,?,?)',[actor,operation.id,operation.item.id,value,operation.createdAt]);},true));}
export async function markCatalogOperation(actor:string,operation:CatalogOperation){return serial(()=>database(async(db,store)=>{const value=await encrypt(operation,await actorKey(store,actor),actor+':'+operation.id);db.run('UPDATE outbox SET value=? WHERE actor=? AND id=?',[value,actor,operation.id]);},true));}
export async function removeCatalogOperation(actor:string,id:string){return serial(()=>database(async db=>{db.run('DELETE FROM outbox WHERE actor=? AND id=?',[actor,id]);},true));}
