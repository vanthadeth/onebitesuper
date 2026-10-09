import publicConfig from "../../../config/supabase.public.json";
import type { Account, AccessState, AccessEvent } from "@onebite/core/access";
export type Snapshot = AccessState & { revision: number };
export type AccessReply = { actor?: Account; state?: Snapshot; session?: string; mustChangePin?: boolean; ownerCreated?: boolean; ok?: boolean; photoPath?: string; events?: AccessEvent[]; nextCursor?: {time:string;id:string}|null };
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || publicConfig.url;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || publicConfig.publishableKey;
export const configured = Boolean(url && key);
const storageKey = "onebite-admin-session";
export function readSession() { try { return sessionStorage.getItem(storageKey) || ""; } catch { return ""; } }
export function setSession(token: string) { try { if(token)sessionStorage.setItem(storageKey,token);else sessionStorage.removeItem(storageKey); } catch { /* Session remains usable in memory. */ } }
export class ApiError extends Error { constructor(public code: string, public status: number) { super(code); } }
export async function accessApi(action: string, payload: Record<string,unknown> = {}, session = ""): Promise<AccessReply> {
 if(!configured)throw new ApiError("not_connected",503);
 let response:Response;
 try{response=await fetch(`${url}/functions/v1/admin-access`,{method:"POST",headers:{"Content-Type":"application/json",apikey:key!,...(session?{Authorization:`Bearer ${session}`}:{})},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(20000),cache:"no-store"});}catch(e){throw new ApiError(e instanceof DOMException&&e.name==="TimeoutError"?"request_timeout":"network_failed",503);}
 let data;try{data=await response.json();}catch{throw new ApiError("request_failed",response.status);}
 if(!response.ok||data.error)throw new ApiError(data.error||"request_failed",response.status);
 return data;
}
