import {useCallback,useEffect,useRef,useState} from 'react';
import {accessApi,ApiError,readSession,setSession,sessionExpiry,rememberedSessionKey,type AccessReply} from '@onebite/accounts';
import {loadPosCache,savePosCache} from '@onebite/offline/pos';
import {effectiveMenu} from '@onebite/core/pos';
import type {SyncStatus} from '@onebite/ui';
import {posApi,type PosBootstrap} from './api';
type Phase='connecting'|'login'|'change-pin'|'mfa'|'ready'|'unavailable'|'denied';
export function usePos(){
 const [phase,setPhase]=useState<Phase>('connecting'),[data,setData]=useState<PosBootstrap|null>(null),[error,setError]=useState(''),[offline,setOffline]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState<SyncStatus>('idle'),[verifiedAt,setVerifiedAt]=useState(0),[enrollment,setEnrollment]=useState(false),[token,setToken]=useState(readSession);
 const active=useRef(true),epoch=useRef(0),syncing=useRef(false),verification=useRef(false),requested=useRef(false);
 const receive=useCallback((reply:AccessReply)=>{if(reply.session||reply.sessionExpiresAt)setSession(reply.session||readSession(),true,reply.sessionExpiresAt);setToken(readSession());setError('');verification.current=Boolean(reply.mustChangePin||reply.mfaRequired);if(reply.mustChangePin){setData(null);setPhase('change-pin');return false;}if(reply.mfaRequired){setData(null);setEnrollment(Boolean(reply.mfaEnrollment));setPhase('mfa');return false;}return true;},[]);
 const refresh=useCallback(async()=>{
  if(verification.current)return;
  if(syncing.current){requested.current=true;return;}
  const session=readSession();if(!session){setData(null);setPhase('login');return;}
  const generation=epoch.current,current=()=>active.current&&epoch.current===generation&&readSession()===session;
  syncing.current=true;setBusy(true);setStatus('syncing');setError('');setToken(session);
  try{
   let reply=await posApi<PosBootstrap>('bootstrap',{},session);if(!current())return;
   const cached=await loadPosCache<PosBootstrap>(session).catch(()=>null),photos:Record<string,string>={};
   const paths=[...new Set(effectiveMenu(reply.versions,reply.serverTime).map(i=>i.photoPath).filter((v):v is string=>Boolean(v)))];
   for(let i=0;i<paths.length;i+=3){await Promise.all(paths.slice(i,i+3).map(async path=>{if(cached?.data.photos?.[path]){photos[path]=cached.data.photos[path];return;}try{const r=await posApi<{photo:string}>('photo.read',{photoPath:path},session);if(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.photo)&&r.photo.length<=1_000_000)photos[path]=r.photo;}catch{}}));if(!current())return;}
   let profilePhoto:string|undefined;if(reply.actor.photoPath){try{profilePhoto=(await accessApi('profile.photo.read',{id:reply.actor.id},session)).photo||undefined;}catch{profilePhoto=cached?.data.actor.photoPath===reply.actor.photoPath?cached.data.profilePhoto:undefined;}}
   reply={...reply,photos,profilePhoto};await savePosCache(session,reply);if(!current())return;setData(reply);setVerifiedAt(Date.now());setOffline(false);setPhase('ready');setStatus('complete');
  }catch(e){
   if(!current())return;const code=e instanceof ApiError?e.code:'storage_failed';setError(code);setStatus('failed');
   if(code==='unauthorized'){epoch.current++;setSession('');setData(null);setPhase('login');}
   else if(code==='forbidden'){setData(null);setPhase('denied');}
   else if(['mfa_required','reauth_required','pin_change_required'].includes(code)){verification.current=true;setData(null);try{const reply=await accessApi('me',{},session);if(current()){receive(reply);if(!reply.mustChangePin&&!reply.mfaRequired){verification.current=true;setEnrollment(false);setPhase('mfa');}}}catch{if(current())setPhase(code==='pin_change_required'?'change-pin':'mfa');}}
   else if(['network_failed','request_timeout'].includes(code)){const cached=await loadPosCache<PosBootstrap>(session).catch(()=>null);if(!current())return;if(cached){setData(cached.data);setVerifiedAt(cached.verifiedAt);setOffline(true);setPhase('ready');setError('');}else{setData(null);setPhase('unavailable');}}
   else{setData(null);setPhase('unavailable');}
  }finally{syncing.current=false;if(active.current){setBusy(false);if(requested.current||epoch.current!==generation){requested.current=false;window.setTimeout(()=>void refresh(),0);}}}
 },[receive]);
 useEffect(()=>{active.current=true;void refresh();const online=()=>void refresh(),offlineEvent=()=>setOffline(true),focus=()=>{if(navigator.onLine)void refresh();},storage=(e:StorageEvent)=>{if(e.key!==rememberedSessionKey)return;epoch.current++;verification.current=false;setData(null);setPhase('connecting');void refresh();};
  window.addEventListener('online',online);window.addEventListener('offline',offlineEvent);window.addEventListener('focus',focus);window.addEventListener('storage',storage);
  const interval=setInterval(()=>{if(!readSession()){epoch.current++;setData(null);setPhase('login');}else if(navigator.onLine)void refresh();},60000);
  return()=>{active.current=false;clearInterval(interval);window.removeEventListener('online',online);window.removeEventListener('offline',offlineEvent);window.removeEventListener('focus',focus);window.removeEventListener('storage',storage);};
 },[refresh]);
 useEffect(()=>{const expiry=sessionExpiry();if(!token||!expiry)return;const timer=setTimeout(()=>{epoch.current++;setSession('');setData(null);setPhase('login');},Math.max(0,expiry-Date.now()));return()=>clearTimeout(timer);},[token]);
 useEffect(()=>{if(!offline||!verifiedAt)return;const timer=setTimeout(()=>{setData(null);setError('offline_expired');setPhase('unavailable');},Math.max(0,verifiedAt+24*60*60_000-Date.now()));return()=>clearTimeout(timer);},[offline,verifiedAt]);
 async function authenticate(payload:Record<string,unknown>){setBusy(true);try{if(receive(await accessApi(phase==='change-pin'?'pin.change':'login',payload,readSession())))await refresh();}catch(e){setError(e instanceof ApiError?e.code:'request_failed');}finally{setBusy(false);}}
 async function signOut(){const session=readSession();epoch.current++;verification.current=false;setSession('');setToken('');setData(null);setPhase('login');try{await accessApi('logout',{},session);}catch{}}
 return {phase,data,error,offline,busy,status,verifiedAt,token,enrollment,refresh,authenticate,signOut,verified:async(reply:AccessReply)=>{if(receive(reply))await refresh();}};
}
