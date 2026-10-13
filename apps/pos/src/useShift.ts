import {useCallback,useEffect,useRef,useState} from 'react';
import {ApiError,sessionExpiry} from '@onebite/accounts';
import {orderingDeviceCredential,loadOperationalCache,saveOperationalCache} from '@onebite/offline/operations';
import type {OperationScope,JsonObject} from '@onebite/core/operations';
import {posApi} from './api';
export type ShiftWorkspace={siteId:number;registered:boolean;ordering:boolean;generation:number;shift:{id:string;openedAt:string;openingCash:number;openingSource:string;openedBy:string}|null;custody:{holderId:string;holderName:string;cash:number}|null;recentShifts:{id:string;openedAt:string;closedAt:string;openingCash:number;countedCash:number;difference:number}[];serverTime:string};
type Action='device.claim'|'device.release'|'shift.open'|'shift.close';
type Request={action:Action;payload:Record<string,string|number>};
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
/** Financial/device changes are online-only. A saved request keeps its ID across uncertain responses. */
export function useShift(actorId:string|undefined,siteId:number|undefined,token:string,offline:boolean){
 const [data,setData]=useState<ShiftWorkspace|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState<Request|null>(null);
 const refreshRef=useRef<()=>Promise<void>>(async()=>{});
 const context=useRef<{scope:OperationScope;credential:{deviceId:string;proof:string};hash:string;cache:JsonObject;wall:number;monotonic:number}|null>(null),epoch=useRef(0),lock=useRef(false),active=useRef(true),offlineRef=useRef(offline);offlineRef.current=offline;
 const refresh=useCallback(async()=>{
  const c=context.current;if(!c||lock.current)return;const generation=epoch.current,current=()=>active.current&&generation===epoch.current;
  lock.current=true;setBusy(true);setError('');
  try{
   if(offlineRef.current||!navigator.onLine)throw new ApiError('network_failed',503);
   const reply=await posApi<ShiftWorkspace>('workspace',{siteId:c.scope.siteId,...c.credential},token);if(!current())return;
   c.wall=Date.now();c.monotonic=performance.now();c.cache={...c.cache,hash:c.hash,verifiedAt:Date.now(),lastSeen:Date.now(),status:reply as unknown as JsonObject,revoked:false};await saveOperationalCache(c.scope,c.cache);if(current())setData(reply);
  }catch(e){if(!current())return;const code=e instanceof ApiError?e.code:'storage_failed';
   if(['network_failed','request_timeout','request_failed'].includes(code)){
    const at=Number(c.cache.verifiedAt),last=Number(c.cache.lastSeen??at),now=Date.now();if(c.cache.hash===c.hash&&!c.cache.revoked&&at>0&&now>=last&&now-at<86400000&&now<(sessionExpiry()??0)){setData(c.cache.status as unknown as ShiftWorkspace);c.cache.lastSeen=now;await saveOperationalCache(c.scope,c.cache);}else{setData(null);setError('connection_required');}
   }else{c.cache.revoked=true;setData(null);setError(code);await saveOperationalCache(c.scope,c.cache).catch(()=>setError('storage_failed'));}
  }finally{lock.current=false;if(current())setBusy(false);else if(active.current)window.setTimeout(()=>void refreshRef.current(),0);}
 },[token]);
 refreshRef.current=refresh;
 useEffect(()=>{
  active.current=true;const generation=++epoch.current;context.current=null;setData(null);setPending(null);setError('');setBusy(true);
  if(!actorId||siteId===undefined||!token){setBusy(false);return;}
  void(async()=>{try{const credential=await orderingDeviceCredential(),scope={actorId,siteId,deviceId:credential.deviceId},hash=await digest(token),cache=await loadOperationalCache(scope);if(!active.current||epoch.current!==generation)return;context.current={scope,credential,hash,cache,wall:Date.now(),monotonic:performance.now()};setPending((cache.pending as unknown as Request)||null);await refresh();}catch{if(active.current&&epoch.current===generation){setError('storage_failed');setBusy(false);}}})();
  const run=()=>void refresh(),timer=setInterval(run,30000);window.addEventListener('online',run);window.addEventListener('focus',run);
  return()=>{epoch.current++;active.current=false;clearInterval(timer);window.removeEventListener('online',run);window.removeEventListener('focus',run);};
 },[actorId,siteId,token,refresh]);
 useEffect(()=>{const timer=setInterval(()=>{const c=context.current;if(!c)return;const at=Number(c.cache.verifiedAt),now=Date.now(),elapsed=c.wall+performance.now()-c.monotonic;/* Monotonic elapsed time prevents a frozen/rolled-back wall clock extending an offline lease. */if(at&&(Math.max(now,elapsed)-at>=86400000||now<Number(c.cache.lastSeen)||now+2000<elapsed)){c.cache.revoked=true;setData(null);setError('connection_required');void saveOperationalCache(c.scope,c.cache).catch(()=>{});}else if(at&&offlineRef.current){c.cache.lastSeen=now;void saveOperationalCache(c.scope,c.cache).catch(()=>{setData(null);setError('storage_failed');});}},15000);return()=>clearInterval(timer);},[]);
 async function submit(action:Action,values:Record<string,string|number>={}){
  const c=context.current;if(!c||lock.current)throw new Error('request_busy');if(!navigator.onLine||offlineRef.current)throw new Error('connection_required');
  const generation=epoch.current,current=()=>active.current&&epoch.current===generation;
  const request=(c.cache.pending as unknown as Request)||{action,payload:{siteId:c.scope.siteId!,deviceId:c.credential.deviceId,generation:data?.generation??0,requestId:crypto.randomUUID(),...values}};
  lock.current=true;setBusy(true);setError('');
  try{
   c.cache={...c.cache,pending:request as unknown as JsonObject};await saveOperationalCache(c.scope,c.cache);if(!current())return;setPending(request);
   await posApi(request.action,{...request.payload,proof:c.credential.proof},token);if(!current())return;
   c.cache={...c.cache,pending:null,status:null,verifiedAt:0};await saveOperationalCache(c.scope,c.cache);if(!current())return;setPending(null);setData(null);
  }catch(e){if(!current())return;const code=e instanceof ApiError?e.code:e instanceof Error?e.message:'request_failed';setError(code);
   if(e instanceof ApiError&&e.status<500){c.cache.pending=null;c.cache.revoked=true;await saveOperationalCache(c.scope,c.cache);if(current()){setPending(null);setData(null);}}
   throw e;
  }finally{lock.current=false;if(current()){setBusy(false);void refresh();}else if(active.current)window.setTimeout(()=>void refreshRef.current(),0);}
 }
 const bound=context.current?.scope.actorId===actorId&&context.current?.scope.siteId===siteId;
 return {data:bound?data:null,busy,error,pending:bound?pending:null,refresh,submit};
}
