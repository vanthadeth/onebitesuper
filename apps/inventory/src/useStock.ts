import {useCallback,useEffect,useRef,useState} from 'react';
import {ApiError,readSession,sessionExpiry} from '@onebite/accounts';
import type {Account} from '@onebite/core/access';
import {centralStockOperation,projectedStock,type StockPayload} from '@onebite/core/stock';
import {replayOperations,OperationTransportError,outboxSummary,type OperationRecord,type OperationScope,type OperationReceipt,type JsonObject} from '@onebite/core/operations';
import {operationalDeviceId,loadOperationalWorkspace,commitOperationalChange,operationalStore,loadOperationalCache,saveOperationalCache} from '@onebite/offline/operations';
import {stockApi,type StockReply} from './stock-api';
const lifetime=24*60*60_000;
const sessionHash=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
export function useStock(actor:Account|undefined,token:string){
 const [data,setData]=useState<StockReply|null>(null),[records,setRecords]=useState<OperationRecord[]>([]),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[offline,setOffline]=useState(false),[verifiedAt,setVerifiedAt]=useState(0);
 const lastVerified=useRef(0);
 const scope=useRef<OperationScope|null>(null),epoch=useRef(0),syncing=useRef(false),requested=useRef(false),syncRef=useRef<()=>Promise<void>>(async()=>{});
 const sync=useCallback(async()=>{
  if(!actor||!scope.current||!token||readSession()!==token)return;if(syncing.current){requested.current=true;return;}
  const generation=epoch.current,currentScope={...scope.current},current=()=>generation===epoch.current&&readSession()===token&&sessionExpiry()>Date.now();
  syncing.current=true;setBusy(true);setError('');
  try{
   let pending=await operationalStore.list(currentScope);if(!current())return;setRecords(pending);
   const list=()=>stockApi<StockReply>('list',{deviceId:currentScope.deviceId,operationIds:pending.map(r=>r.operation.id)},token);
   let reply=await list();if(!current())return;if(reply.actor.id!==actor.id)throw new ApiError('unauthorized',401);setData(reply);setOffline(false);
   const replay=await replayOperations({scope:currentScope,store:operationalStore,authorize:async()=>current(),send:async operation=>{
    try{return await stockApi<OperationReceipt>('post',{operation},token);}catch(e){if(!(e instanceof ApiError))throw e;const category=['unauthorized','forbidden','mfa_required','reauth_required','pin_change_required'].includes(e.code)?'auth':['network_failed','request_failed','request_timeout','server_configuration'].includes(e.code)?'retry':'review';throw new OperationTransportError(category,e.code);}
   }});pending=await operationalStore.list(currentScope);if(!current())return;setRecords(pending);if(replay.stopped)throw new ApiError(replay.stopped,503);
   reply=await list();if(!current())return;if(reply.actor.id!==actor.id)throw new ApiError('unauthorized',401);
   const checked=replay.pending?lastVerified.current:Date.now();await saveOperationalCache(currentScope,{data:reply as unknown as JsonObject,verifiedAt:checked,sessionHash:await sessionHash(token)});if(!current())return;lastVerified.current=checked;setData(reply);setVerifiedAt(checked);setOffline(false);
  }catch(e){if(!current())return;const code=e instanceof ApiError?e.code:e instanceof Error?e.message:'storage_failed';
   if(['network_failed','request_timeout'].includes(code)){
    const cache=await loadOperationalCache(currentScope).catch(()=>null);if(!current())return;
    if(cache&&cache.sessionHash===await sessionHash(token)&&typeof cache.verifiedAt==='number'&&cache.verifiedAt<=Date.now()&&Date.now()-cache.verifiedAt<lifetime){lastVerified.current=cache.verifiedAt;setData(cache.data as unknown as StockReply);setVerifiedAt(cache.verifiedAt);setOffline(true);setError('');}else{setData(null);setOffline(true);setError('offline_expired');}
   }else{setError(code);if(['forbidden','unauthorized','mfa_required','reauth_required','pin_change_required'].includes(code)){setData(null);await saveOperationalCache(currentScope,{revoked:true}).catch(()=>{});}}
  }finally{syncing.current=false;if(generation===epoch.current)setBusy(false);if(requested.current){requested.current=false;queueMicrotask(()=>void syncRef.current());}}
 },[actor?.id,token]);
 syncRef.current=sync;
 useEffect(()=>{
  const generation=++epoch.current;scope.current=null;lastVerified.current=0;setData(null);setRecords([]);setError('');setOffline(false);setVerifiedAt(0);setBusy(false);setSaving(false);
  if(!actor||!token)return;
  void (async()=>{try{const deviceId=await operationalDeviceId();if(generation!==epoch.current)return;scope.current={actorId:actor.id,siteId:null,deviceId};const rows=await operationalStore.list(scope.current);if(generation!==epoch.current)return;setRecords(rows);await syncRef.current();}catch{if(generation===epoch.current)setError('storage_failed');}})();return()=>{epoch.current++;};
 },[actor?.id,token]);
 useEffect(()=>{if(!actor)return;const refresh=()=>void syncRef.current();window.addEventListener('online',refresh);window.addEventListener('focus',refresh);const timer=setInterval(()=>{if(navigator.onLine&&(data||records.length||error!=='forbidden'))refresh();},15000);return()=>{clearInterval(timer);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);};},[actor?.id,Boolean(data),records.length,error]);
 useEffect(()=>{if(!offline||!verifiedAt)return;const timer=setTimeout(()=>{setData(null);setError('offline_expired');},Math.max(0,verifiedAt+lifetime-Date.now()));return()=>clearTimeout(timer);},[offline,verifiedAt]);
 async function save(kind:'stock.opening'|'stock.receive',payload:StockPayload){
  const generation=epoch.current,currentScope=scope.current;if(!data||!actor||!currentScope||readSession()!==token||sessionExpiry()<=Date.now()||verifiedAt>Date.now()||Date.now()-verifiedAt>=lifetime||kind==='stock.opening'&&(!data.canOpen||actor.role!=='Owner')||kind==='stock.receive'&&!data.canReceive)throw new Error('forbidden');
  setSaving(true);try{const workspace=await loadOperationalWorkspace(currentScope),op=await centralStockOperation(currentScope,kind,payload,data.items);if(generation!==epoch.current||readSession()!==token)throw new Error('unauthorized');
   const included=data.includedIds,local=projectedStock(data.balances,[...workspace.operations.filter(r=>r.status!=='review').map(r=>r.operation),op],included);
   await commitOperationalChange(currentScope,workspace.revision,{balances:local as unknown as JsonObject[]},op);if(generation!==epoch.current)return;setRecords(await operationalStore.list(currentScope));setError('');if(navigator.onLine)void syncRef.current();
  }finally{if(generation===epoch.current)setSaving(false);}
 }
 const totals=outboxSummary(records),balances=data?projectedStock(data.balances,records.filter(r=>r.status!=='review').map(r=>r.operation),data.includedIds):[];
 return {data,records,balances,busy,saving,error,offline,verifiedAt,pending:totals.pending,review:totals.review,sync,save};
}
