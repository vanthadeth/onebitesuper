import {ApiError} from '@onebite/accounts';
import type {Account,AccessSite,Permission} from '@onebite/core/access';
import type {AppSettings} from '@onebite/core/app-settings';
import type {ItemVersion} from '@onebite/core/inventory';
import config from '../../../config/supabase.public.json';
export type PosBootstrap={actor:Account;permissions:Permission[];roleName:string;sites:AccessSite[];appSettings:AppSettings;versions:ItemVersion[];serverTime:string;photos?:Record<string,string>;profilePhoto?:string};
export async function posApi<T>(action:string,payload:Record<string,unknown>,token:string):Promise<T>{
 let response:Response;try{response=await fetch(`${import.meta.env.VITE_SUPABASE_URL||config.url}/functions/v1/pos-access`,{method:'POST',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||config.publishableKey,Authorization:`Bearer ${token}`},body:JSON.stringify({action,payload}),cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw new ApiError('network_failed',503);}
 const reply=await response.json().catch(()=>({error:'request_failed'}));if(!response.ok||reply.error)throw new ApiError(reply.error||'request_failed',response.status);return reply;
}
