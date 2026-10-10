import type { Database, SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

// SQLite runs on every supported browser; IndexedDB persists its database file.
// No OPFS/SharedArrayBuffer requirements on GitHub Pages or iOS Safari.
const databaseName='onebite-offline-v1';
let queue=Promise.resolve();
function serial<T>(operation:()=>Promise<T>):Promise<T>{const task=queue.then(()=>navigator.locks?navigator.locks.request(databaseName,operation):operation());queue=task.then(()=>{},()=>{});return task;}
async function fileStore(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function withDatabase<T>(operation:(db:Database)=>T,write:boolean):Promise<T>{
 const storage=await fileStore();let db:Database|undefined;
 try{
  const bytes=await new Promise<Uint8Array|undefined>((resolve,reject)=>{const request=storage.transaction('files').objectStore('files').get('sqlite');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const SQL=await engine!;db=new SQL.Database(bytes);
  db.run('CREATE TABLE IF NOT EXISTS snapshots (scope TEXT PRIMARY KEY, encrypted TEXT NOT NULL, verified_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0)');
  if(!db.exec('PRAGMA table_info(snapshots)')[0]?.values.some(row=>row[1]==='revision'))db.run('ALTER TABLE snapshots ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
  const result=operation(db);
  if(write){const file=db.export();await new Promise<void>((resolve,reject)=>{const tx=storage.transaction('files','readwrite');tx.objectStore('files').put(file,'sqlite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  return result;
 }finally{db?.close();storage.close();}
}
let engine:Promise<SqlJsStatic>|undefined;
function ready(){engine??=import('sql.js').then(({default:initSqlJs})=>initSqlJs({locateFile:()=>wasmUrl}));}
async function scope(token:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}
async function key(token:string){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode('onebite-cache:'+token)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
const encode=(bytes:Uint8Array)=>btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
const decode=(value:string)=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
export type CachedSnapshot<T>={data:T;verifiedAt:number};
export async function saveSnapshot<T>(token:string,data:T){
 if(!/^[a-f0-9]{64}$/.test(token))return;
 ready();const verifiedAt=Date.now(),id=await scope(token),iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},await key(token),new TextEncoder().encode(JSON.stringify({data,verifiedAt})));
 const value=JSON.stringify({iv:encode(iv),data:encode(new Uint8Array(encrypted))});
 const revision=(data as {state?:{revision?:number}}).state?.revision??0;
 return serial(()=>withDatabase(db=>{db.run('DELETE FROM snapshots WHERE verified_at < ?',[Date.now()-10*60_000]);db.run('INSERT INTO snapshots (scope, encrypted, verified_at, revision) VALUES (?, ?, ?, ?) ON CONFLICT(scope) DO UPDATE SET encrypted=excluded.encrypted, verified_at=excluded.verified_at, revision=excluded.revision WHERE excluded.revision >= snapshots.revision',[id,value,verifiedAt,revision]);},true));
}
export async function loadSnapshot<T>(token:string):Promise<CachedSnapshot<T>|null>{
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 ready();const id=await scope(token);
 const record=await serial(()=>withDatabase(db=>{const statement=db.prepare('SELECT encrypted, verified_at FROM snapshots WHERE scope = ?');try{statement.bind([id]);return statement.step()?statement.getAsObject():null;}finally{statement.free();}},false));
 if(!record||typeof record.verified_at!=='number'||Date.now()-record.verified_at>=10*60_000||record.verified_at>Date.now())return null;
 try{const value=JSON.parse(String(record.encrypted));const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(value.iv),additionalData:new TextEncoder().encode(id)},await key(token),decode(value.data));const payload=JSON.parse(new TextDecoder().decode(clear));if(payload.verifiedAt!==record.verified_at)return null;return {data:payload.data,verifiedAt:record.verified_at};}catch{return null;}
}
export async function clearSnapshots(){return serial(async()=>{const storage=await fileStore();try{await new Promise<void>((resolve,reject)=>{const tx=storage.transaction('files','readwrite');tx.objectStore('files').delete('sqlite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{storage.close();}});}
export {cleanSampleData} from './cleanup';
