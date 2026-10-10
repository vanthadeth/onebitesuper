import {saveSnapshot,loadSnapshot,clearSnapshots} from "@onebite/offline";
import publicConfig from "../../../config/supabase.public.json";
import type { Account, AccessState, AccessEvent } from "@onebite/core/access";
export type Snapshot = AccessState & { revision: number };
export type AccessReply = { offline?:boolean; cachedAt?:number; cacheUnavailable?:boolean; actor?: Account; state?: Snapshot; session?: string; mustChangePin?: boolean; ownerCreated?: boolean; ok?: boolean; mfaRequired?:boolean; mfaEnrollment?:boolean; secret?:string; uri?:string; recoveryCodes?:string[]; photoPath?: string; events?: AccessEvent[]; nextCursor?: {time:string;id:string}|null };
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || publicConfig.url;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || publicConfig.publishableKey;
export const configured = Boolean(url && key);
export const rememberedSessionKey = "onebite-admin-session";
const maximumSessionAge = 8 * 60 * 60 * 1000;
let currentSession = "", expiresAt = 0, memoryOnly=false;
function clearLegacySession(){try{sessionStorage.removeItem(rememberedSessionKey);}catch{}}
export function readSession(){
 clearLegacySession();
 try{
  const raw=localStorage.getItem(rememberedSessionKey);
  if(raw){
   let saved;try{saved=JSON.parse(raw);}catch{setSession("");return "";}
   if(!saved||typeof saved.token!=="string"||!/^[a-f0-9]{64}$/.test(saved.token)||!Number.isFinite(saved.expiresAt)||saved.expiresAt<=Date.now()||saved.expiresAt>Date.now()+maximumSessionAge){setSession("");return "";}
   currentSession=saved.token;expiresAt=saved.expiresAt;
  }else if(!memoryOnly){currentSession="";expiresAt=0;}
 }catch{/* Storage can be unavailable; keep the in-memory session for this tab. */}
 if(expiresAt<=Date.now()){setSession("");return "";}
 return currentSession;
}
export function setSession(token:string, persist=true){
 currentSession=/^[a-f0-9]{64}$/.test(token)?token:"";expiresAt=currentSession?Date.now()+maximumSessionAge:0;
 clearLegacySession();memoryOnly=false;
 if(!persist)return;
 if(!currentSession)void clearSnapshots().catch(()=>{});
 try{if(currentSession)localStorage.setItem(rememberedSessionKey,JSON.stringify({token:currentSession,expiresAt}));else localStorage.removeItem(rememberedSessionKey);}catch{memoryOnly=Boolean(currentSession);}
}
export class ApiError extends Error { constructor(public code: string, public status: number) { super(code); } }
export async function accessApi(action: string, payload: Record<string,unknown> = {}, session = ""): Promise<AccessReply> {
 if(!configured)throw new ApiError("not_connected",503);
 let response:Response;
 try{response=await fetch(`${url}/functions/v1/admin-access`,{method:"POST",headers:{"Content-Type":"application/json",apikey:key!,...(session?{Authorization:`Bearer ${session}`}:{})},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(20000),cache:"no-store"});}catch(e){
  if(action==="me"&&session){try{const cached=await loadSnapshot<AccessReply>(session);if(cached?.data.actor&&cached.data.state)return {...cached.data,offline:true,cachedAt:cached.verifiedAt};}catch{}}
  throw new ApiError(e instanceof DOMException&&e.name==="TimeoutError"?"request_timeout":"network_failed",503);
 }
 let data;try{data=await response.json();}catch{throw new ApiError("request_failed",response.status);}
 if(!response.ok||data.error)throw new ApiError(data.error||"request_failed",response.status);
 if(data.state&&(data.actor||session)&&(data.session||readSession()===session)){
  const token=data.session||session;
  try{const previous=data.actor?null:await loadSnapshot<AccessReply>(token);const actor=data.actor||data.state.users.find((user:Account)=>user.id===previous?.data.actor?.id);if(actor)await saveSnapshot(token,{actor,state:data.state});}catch{data.cacheUnavailable=true;}
 }
 return data;
}
