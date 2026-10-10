import config from '../../../config/supabase.public.json';
import {ApiError} from '@onebite/accounts';
import type {Account} from '@onebite/core/access';
import type {CatalogItem,CatalogOperation} from '@onebite/core/inventory';
export type CatalogReply={actor:Account;canEdit:boolean;items:CatalogItem[];photos?:Record<string,string>;profilePhoto?:string};
export async function inventoryApi<T>(action:string,payload:Record<string,unknown>,token:string):Promise<T>{
 let response:Response;
 try{response=await fetch(`${import.meta.env.VITE_SUPABASE_URL||config.url}/functions/v1/inventory-access`,{method:'POST',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||config.publishableKey,Authorization:`Bearer ${token}`},body:JSON.stringify({action,payload}),cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw new ApiError('network_failed',503);}
 const data=await response.json().catch(()=>({error:'request_failed'}));if(!response.ok||data.error)throw new ApiError(data.error||'request_failed',response.status);return data;
}
export function publishCatalogOperation(operation:CatalogOperation,token:string){return inventoryApi<{item:CatalogItem}>('save',{id:operation.id,item:operation.item,...(operation.image!==undefined?{image:operation.image}:{})},token);}
