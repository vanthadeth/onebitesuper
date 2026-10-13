import {boundedBody} from '../admin-access/security.ts';
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',allowed=(Deno.env.get('ONEBITE_ALLOWED_ORIGINS')||'https://vanthadeth.github.io').split(',').map(value=>value.trim());
 const headers:Record<string,string>={'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
 const respond=(value:unknown,status=200)=>Response.json(value,{status,headers});
 if(origin&&!allowed.includes(origin))return respond({error:'forbidden'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
 try{
  const publicKeys=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  const keys=[Deno.env.get('SUPABASE_ANON_KEY'),...(publicKeys?Object.values(JSON.parse(publicKeys)):[])];
  if(!req.headers.get('apikey')||!keys.includes(req.headers.get('apikey')))return respond({error:'invalid_api_key'},401);
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!/^[a-f0-9]{64}$/.test(token))return respond({error:'unauthorized'},401);
  const raw=await boundedBody(req);if(new TextEncoder().encode(raw).length>16000)return respond({error:'payload_too_large'},413);
  const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return respond({error:'invalid_action'},400);if(!['bootstrap','photo.read','workspace','device.claim','device.release','shift.open','shift.close'].includes(body.action)||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload))return respond({error:'invalid_action'},400);
  if(body.action==='photo.read'&&!(typeof body.payload.photoPath==='string'&&/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(body.payload.photoPath)))return respond({error:'invalid_photo'},400);
  const control=!['bootstrap','photo.read'].includes(body.action);
  let payload:Record<string,unknown>={};
  if(control){const p=body.payload;if(!Number.isInteger(p.siteId)||p.siteId<0||p.siteId>999999999||typeof p.deviceId!=='string'||!/^[a-f0-9-]{36}$/.test(p.deviceId)||typeof p.proof!=='string'||!/^[a-f0-9]{64}$/.test(p.proof))return respond({error:'invalid_request'},400);
   payload={siteId:p.siteId,deviceId:p.deviceId,proofHash:await hash(p.proof)};
   if(body.action!=='workspace'){if(typeof p.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(p.requestId)||!Number.isSafeInteger(p.generation)||p.generation<0||p.generation>999999999999)return respond({error:'invalid_request'},400);Object.assign(payload,{requestId:p.requestId,generation:p.generation});}
   if(body.action==='shift.open'||body.action==='shift.close'){if(typeof p.cash!=='string'||!/^\d{1,13}$/.test(p.cash))return respond({error:'invalid_cash'},400);payload.cash=p.cash;}
   if(body.action==='shift.open')payload.source=p.source;
   if(body.action==='shift.close')payload.shiftId=p.shiftId;
  }
  const secrets=Deno.env.get('SUPABASE_SECRET_KEYS'),key=secrets?JSON.parse(secrets).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!key)return respond({error:'server_configuration'},503);
  const serviceHeaders:Record<string,string>={apikey:key,'Content-Type':'application/json'};if(key.startsWith('eyJ'))serviceHeaders.Authorization=`Bearer ${key}`;
  const url=Deno.env.get('SUPABASE_URL'),response=await fetch(`${url}/rest/v1/rpc/${control?'onebite_pos_control':'onebite_pos_api'}`,{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_action:body.action,p_payload:control?payload:body.action==='photo.read'?{photoPath:body.payload.photoPath}:{},p_session_hash:await hash(token)}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return respond({error:'request_failed'},502);
  let result=await response.json();if(result.error)return respond(result,result.error==='unauthorized'?401:result.error==='forbidden'?403:['device_changed','device_in_use','shift_active','request_conflict','handover_required'].includes(result.error)?409:400);
  if(body.action==='photo.read'){
   const photo=await fetch(`${url}/storage/v1/object/authenticated/catalog-photos/${result.photoPath}`,{headers:serviceHeaders,signal:AbortSignal.timeout(15000)});if(!photo.ok)return respond({error:'photo_read_failed'},502);
   const bytes=new Uint8Array(await photo.arrayBuffer());if(bytes.length>750000)return respond({error:'invalid_photo'},400);
   let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);result={photo:'data:image/jpeg;base64,'+btoa(binary)};
  }
  return respond(result);
 }catch(error){if(error instanceof Error&&error.message==='payload_too_large')return respond({error:'payload_too_large'},413);if(error instanceof SyntaxError)return respond({error:'invalid_request'},400);console.warn(JSON.stringify({event:'pos_request_failed'}));return respond({error:'request_failed'},503);}
});
