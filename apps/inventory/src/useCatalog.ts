import {useCallback,useEffect,useRef,useState} from 'react';
import {accessApi,ApiError,readSession,setSession,sessionExpiry,rememberedSessionKey,type AccessReply} from '@onebite/accounts';
import {loadCatalogCache,saveCatalogCache,inventoryOutbox,queueCatalogOperation,removeCatalogOperation,markCatalogOperation,referenceOutbox,queueReferenceOperation,removeReferenceOperation,markReferenceOperation} from '@onebite/offline/inventory';
import {validateCatalogItem,validateCatalogReference,type CatalogReference,type ReferenceOperation,type CatalogItem,type CatalogOperation} from '@onebite/core/inventory';
import {inventoryApi,publishCatalogOperation,publishReferenceOperation,type CatalogReply} from './api';
import type {SyncStatus} from '@onebite/ui';
export type CatalogPhase='connecting'|'login'|'change-pin'|'mfa'|'ready'|'unavailable'|'denied';
export function useCatalog(){
 const [phase,setPhase]=useState<CatalogPhase>('connecting'),[data,setData]=useState<CatalogReply|null>(null),[pending,setPending]=useState<CatalogOperation[]>([]),[error,setError]=useState('');
 const [referencePending,setReferencePending]=useState<ReferenceOperation[]>([]);
 const [network,setNetwork]=useState(navigator.onLine),[offline,setOffline]=useState(false),[busy,setBusy]=useState(false),[syncStatus,setSyncStatus]=useState<SyncStatus>('idle'),[verifiedAt,setVerifiedAt]=useState(0),[enrollment,setEnrollment]=useState(false),[token,setToken]=useState(readSession);
 const verificationPending=useRef(false),requested=useRef(false),syncing=useRef(false),active=useRef(true),epoch=useRef(0);
 const receiveAuth=useCallback(async(reply:AccessReply)=>{
  if(reply.session||reply.sessionExpiresAt)setSession(reply.session||readSession(),true,reply.sessionExpiresAt);
  setToken(readSession());setError('');verificationPending.current=Boolean(reply.mustChangePin||reply.mfaRequired);
  if(reply.mustChangePin){setPhase('change-pin');return false;}
  if(reply.mfaRequired){setEnrollment(Boolean(reply.mfaEnrollment));setPhase('mfa');return false;}
  return true;
 },[]);
 const sync=useCallback(async()=>{
  if(verificationPending.current)return;
  if(syncing.current){requested.current=true;return;}
  const session=readSession();if(!session){setData(null);setPending([]);setReferencePending([]);setPhase('login');return;}
  const generation=epoch.current;const current=()=>active.current&&generation===epoch.current&&readSession()===session;
  syncing.current=true;setBusy(true);setToken(session);setError('');setSyncStatus('syncing');
  try{
   let reply=await inventoryApi<CatalogReply>('list',{},session);
   if(!current())return;
   let referenceOperations=await referenceOutbox(reply.actor.id);setReferencePending(referenceOperations);
   for(const operation of referenceOperations){
    if(!current())return;if(operation.error)continue;
    if(!reply.canEdit||reply.actor.role!=='Owner'){await markReferenceOperation(reply.actor.id,{...operation,error:'forbidden'});continue;}
    try{await publishReferenceOperation(operation,session);if(!current())return;await removeReferenceOperation(reply.actor.id,operation.id);}
    catch(e){
     if(e instanceof ApiError&&['network_failed','request_timeout','unauthorized','mfa_required','reauth_required','request_failed','server_configuration'].includes(e.code))throw e;
     await markReferenceOperation(reply.actor.id,{...operation,error:e instanceof ApiError?e.code:'request_failed'});
    }
   }
   referenceOperations=await referenceOutbox(reply.actor.id);if(current())setReferencePending(referenceOperations);
   let operations=await inventoryOutbox(reply.actor.id);setData(reply);setPending(operations);setPhase('ready');setOffline(false);
   for(const operation of operations){
    if(!current())return;
    if(operation.error)continue;
    if(!reply.canEdit||reply.actor.role!=='Owner'){await markCatalogOperation(reply.actor.id,{...operation,error:'forbidden'});continue;}
    try{await publishCatalogOperation(operation,session);if(!current())return;await removeCatalogOperation(reply.actor.id,operation.id);}
    catch(e){
     if(e instanceof ApiError&&['network_failed','request_timeout','unauthorized','mfa_required','reauth_required','request_failed','photo_upload_failed','photo_read_failed','server_configuration'].includes(e.code))throw e;
     await markCatalogOperation(reply.actor.id,{...operation,error:e instanceof ApiError?e.code:'request_failed'});
    }
    operations=await inventoryOutbox(reply.actor.id);if(current())setPending(operations);
   }
   if(!current())return;
   reply=await inventoryApi<CatalogReply>('list',{},session);
   const cached=await loadCatalogCache<CatalogReply>(session);const photos:Record<string,string>={};
   const paths=[...new Set(reply.items.map(item=>item.photoPath).filter((path):path is string=>Boolean(path)))];
   // Photos are private. Persist only images belonging to the authorized catalog.
   for(let start=0;start<paths.length;start+=3){await Promise.all(paths.slice(start,start+3).map(async path=>{if(cached?.data.photos?.[path]){photos[path]=cached.data.photos[path];return;}try{const photo=await inventoryApi<{photo:string}>('photo.read',{photoPath:path},session);if(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo.photo)&&photo.photo.length<=1_000_000)photos[path]=photo.photo;}catch{/* A missing photo does not hide catalog data. */}}));if(!current())return;}
   let profilePhoto:string|undefined;
   if(reply.actor.photoPath){try{profilePhoto=(await accessApi('profile.photo.read',{id:reply.actor.id},session)).photo||undefined;}catch{profilePhoto=cached?.data.actor.photoPath===reply.actor.photoPath?cached.data.profilePhoto:undefined;}}
   reply={...reply,photos,profilePhoto};
   await saveCatalogCache(session,reply);operations=await inventoryOutbox(reply.actor.id);
   if(!current())return;setData(reply);setPending(operations);setVerifiedAt(Date.now());setPhase('ready');setOffline(false);setSyncStatus(operations.length||referenceOperations.length?'failed':'complete');
  }catch(e){
   if(!current())return;const code=e instanceof ApiError?e.code:'storage_failed';setError(code);setSyncStatus('failed');
   if(code==='unauthorized'){setSession('');epoch.current++;setData(null);setPending([]);setReferencePending([]);setPhase('login');}
   else if(code==='forbidden'){setData(null);setPending([]);setReferencePending([]);setPhase('denied');}
   else if(['mfa_required','reauth_required','pin_change_required'].includes(code)){
    verificationPending.current=true;
    try{const auth=await accessApi('me',{},session);if(current()){if(await receiveAuth(auth)){verificationPending.current=true;setEnrollment(false);setPhase('mfa');}}}catch{if(current())setPhase(code==='pin_change_required'?'change-pin':'mfa');}
   }else if(['network_failed','request_timeout'].includes(code)){
    const cached=await loadCatalogCache<CatalogReply>(session).catch(()=>null);
    if(!current())return;
    if(cached){setData(cached.data);setPending(await inventoryOutbox(cached.data.actor.id));setReferencePending(await referenceOutbox(cached.data.actor.id));setVerifiedAt(cached.verifiedAt);setOffline(true);setPhase('ready');setError('');}else{setData(null);setPending([]);setReferencePending([]);setPhase('unavailable');}
   }
  }finally{syncing.current=false;if(active.current){setBusy(false);if(requested.current||generation!==epoch.current){requested.current=false;window.setTimeout(()=>void sync(),0);}}}
 },[receiveAuth]);
 useEffect(()=>{active.current=true;void sync();const online=()=>{setNetwork(true);void sync();},offlineEvent=()=>{setNetwork(false);setOffline(true);};
  const focus=()=>{if(navigator.onLine)void sync();};
  const storageEvent=(event:StorageEvent)=>{if(event.key!==rememberedSessionKey)return;verificationPending.current=false;epoch.current++;setData(null);setPending([]);setReferencePending([]);setPhase('connecting');void sync();};
  const interval=window.setInterval(()=>{if(!readSession()){setData(null);setPending([]);setReferencePending([]);setPhase('login');}else if(navigator.onLine)void sync();},60000);
  window.addEventListener('online',online);window.addEventListener('offline',offlineEvent);window.addEventListener('focus',focus);window.addEventListener('storage',storageEvent);
  return()=>{active.current=false;window.clearInterval(interval);window.removeEventListener('online',online);window.removeEventListener('offline',offlineEvent);window.removeEventListener('focus',focus);window.removeEventListener('storage',storageEvent);};
 },[sync]);
 useEffect(()=>{const expiry=sessionExpiry();if(!token||!expiry)return;const timer=window.setTimeout(()=>{epoch.current++;setSession('');setData(null);setPending([]);setReferencePending([]);setPhase('login');},Math.max(0,expiry-Date.now()));return()=>clearTimeout(timer);},[token]);
 useEffect(()=>{if(!offline||busy)return;const timer=window.setTimeout(()=>{if(navigator.onLine)void sync();},3000);return()=>clearTimeout(timer);},[offline,busy,sync]);
 useEffect(()=>{if(!offline||!verifiedAt)return;const timer=window.setTimeout(()=>{setData(null);setPending([]);setReferencePending([]);setPhase('unavailable');setError('offline_expired');},Math.max(0,verifiedAt+24*60*60_000-Date.now()));return()=>clearTimeout(timer);},[offline,verifiedAt]);
 async function authenticate(payload:Record<string,unknown>){setBusy(true);setError('');try{const reply=await accessApi(phase==='change-pin'?'pin.change':'login',payload,readSession());if(await receiveAuth(reply))await sync();}catch(e){setError(e instanceof ApiError?e.code:'request_failed');}finally{setBusy(false);}}
 async function save(item:CatalogItem,image?:string|null,confirmedActive=false){
  if(!data?.canEdit||data.actor.role!=='Owner'||readSession()!==token||!readSession()||sessionExpiry()<=Date.now()||offline&&Date.now()-verifiedAt>=24*60*60_000)throw new Error('forbidden');
  const normalized=validateCatalogItem(item);
  await queueCatalogOperation(data.actor.id,{id:crypto.randomUUID(),item:normalized,confirmedActive,...(image!==undefined?{image}:{}),createdAt:Date.now()});
  setPending(await inventoryOutbox(data.actor.id));if(navigator.onLine)void sync();
 }
 async function saveReference(reference:CatalogReference,confirmedActive=false){
  if(!data?.canEdit||data.actor.role!=='Owner'||readSession()!==token||!readSession()||sessionExpiry()<=Date.now()||offline&&Date.now()-verifiedAt>=24*60*60_000)throw new Error('forbidden');
  const normalized=validateCatalogReference(reference);
  await queueReferenceOperation(data.actor.id,{id:crypto.randomUUID(),reference:normalized,confirmedActive,createdAt:Date.now()});
  setReferencePending(await referenceOutbox(data.actor.id));if(navigator.onLine)void sync();
 }
 async function discardReference(id:string){if(!data)return;await removeReferenceOperation(data.actor.id,id);setReferencePending(await referenceOutbox(data.actor.id));setError('');if(navigator.onLine)void sync();}
 async function discard(id:string){if(!data)return;await removeCatalogOperation(data.actor.id,id);setPending(await inventoryOutbox(data.actor.id));setError('');if(navigator.onLine)void sync();}
 async function signOut(){const session=readSession();epoch.current++;verificationPending.current=false;setSession('');setToken('');setData(null);setPending([]);setReferencePending([]);setPhase('login');try{await accessApi('logout',{},session);}catch{}}
 return {phase,data,pending,referencePending,error,network,offline,busy,syncStatus,verifiedAt,enrollment,token,sync,authenticate,save,saveReference,discard,discardReference,signOut,verified:async(reply:AccessReply)=>{if(await receiveAuth(reply))await sync();}};
}
