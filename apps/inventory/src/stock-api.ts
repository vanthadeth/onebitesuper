import {ApiError} from '@onebite/accounts';
import type {Account} from '@onebite/core/access';
import type {CatalogItem} from '@onebite/core/inventory';
import type {StockBalance,StockMovement} from '@onebite/core/stock';
import config from '../../../config/supabase.public.json';
export type StockReply={actor:Account;canReceive:boolean;canOpen:boolean;items:CatalogItem[];balances:StockBalance[];includedIds:string[];movements:StockMovement[];serverTime:string};
export async function stockApi<T>(action:'list'|'post',payload:Record<string,unknown>,token:string):Promise<T>{
 let response:Response;try{response=await fetch(`${import.meta.env.VITE_SUPABASE_URL||config.url}/functions/v1/stock-access`,{method:'POST',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||config.publishableKey,Authorization:`Bearer ${token}`},body:JSON.stringify({action,payload}),cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw new ApiError('network_failed',503);}
 const reply=await response.json().catch(()=>({error:'request_failed'}));if(!response.ok||reply.error)throw new ApiError(reply.error||'request_failed',response.status);return reply;
}
