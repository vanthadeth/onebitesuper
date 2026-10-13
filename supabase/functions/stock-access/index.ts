import {boundedBody} from '../admin-access/security.ts';
import {validateOperation,type Operation} from '../../../packages/core/src/operations.ts';
import {normalizeStockPayload} from '../../../packages/core/src/stock.ts';
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',allowed=(Deno.env.get('ONEBITE_ALLOWED_ORIGINS')||'https://vanthadeth.github.io').split(',').map(value=>value.trim()),headers:Record<string,string>={'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',Vary:'Origin'};
 if(allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;const respond=(body:unknown,status=200)=>Response.json(body,{status,headers});
 if(origin&&!allowed.includes(origin))return respond({error:'forbidden'},403);if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
 try{
  const publicKeys=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),keys=[Deno.env.get('SUPABASE_ANON_KEY'),...(publicKeys?Object.values(JSON.parse(publicKeys)):[])];if(!req.headers.get('apikey')||!keys.includes(req.headers.get('apikey')))return respond({error:'invalid_api_key'},401);
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';if(!/^[a-f0-9]{64}$/.test(token))return respond({error:'unauthorized'},401);
  const raw=await boundedBody(req);if(new TextEncoder().encode(raw).length>96_000)return respond({error:'payload_too_large'},413);
  const body=JSON.parse(raw);if(!['list','post'].includes(body.action)||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload))return respond({error:'invalid_action'},400);
  let payload:Record<string,unknown>;
  if(body.action==='post'){
   const op=body.payload.operation as Operation;try{await validateOperation(op,{actorId:op.actorId,siteId:null,deviceId:op.deviceId});normalizeStockPayload(op.payload);if(!['stock.opening','stock.receive'].includes(op.kind)||op.shiftId!==null||op.dependencies.length)throw new Error();}catch{return respond({error:'invalid_stock_operation'},400);}payload={operation:op};
  }else payload={deviceId:body.payload.deviceId,operationIds:body.payload.operationIds};
  const secrets=Deno.env.get('SUPABASE_SECRET_KEYS'),key=secrets?JSON.parse(secrets).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!key)return respond({error:'server_configuration'},503);
  const serviceHeaders:Record<string,string>={apikey:key,'Content-Type':'application/json'};if(key.startsWith('eyJ'))serviceHeaders.Authorization=`Bearer ${key}`;
  const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/onebite_stock_api`,{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_action:body.action,p_payload:payload,p_session_hash:await hash(token)}),signal:AbortSignal.timeout(15000)});if(!response.ok)return respond({error:'request_failed'},502);
  const result=await response.json();if(result.error)return respond(result,result.error==='unauthorized'?401:result.error==='forbidden'?403:['opening_exists','operation_conflict','invalid_stock_item'].includes(result.error)?409:400);return respond(result);
 }catch(error){if(error instanceof Error&&error.message==='payload_too_large')return respond({error:'payload_too_large'},413);console.warn(JSON.stringify({event:'stock_request_failed'}));return respond({error:'request_failed'},503);}
});
