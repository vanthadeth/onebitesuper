// Internal username/PIN authentication. No Supabase Auth identity is assumed.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
const actions = new Set(["bootstrap.status","bootstrap","login","logout","me","pin.change","user.create","user.update","sites.assign","site.create","site.update","site.photo.upload","settings.update","activity.list","permissions.update","role.create","pin.reset"]);
const sha256 = async (value: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,"0")).join("");
const respond = (data: unknown, status = 200) => Response.json(data,{status,headers:cors});
declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request)=>Promise<Response>): void };
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
 let requestAction='unknown';
 try{
  const raw=await req.text();if(raw.length>1000000)return respond({error:"payload_too_large"},413);
  const {action,payload={}}=JSON.parse(raw);
  if(typeof action!=="string"||!actions.has(action)||!payload||typeof payload!=="object"||Array.isArray(payload))return respond({error:"invalid_action"},400);
  requestAction=action;
  if(action!=="site.photo.upload"&&raw.length>16000)return respond({error:"payload_too_large"},413);
  const suppliedKey=req.headers.get("apikey");
  const publicKeys=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const allowedPublic=[Deno.env.get("SUPABASE_ANON_KEY"),...(publicKeys?Object.values(JSON.parse(publicKeys)):[])];
  if(!suppliedKey||!allowedPublic.includes(suppliedKey))return respond({error:"invalid_api_key"},401);
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")||"";
  const publicAction=["bootstrap.status","bootstrap","login"].includes(action);
  if(!publicAction&&!/^[a-f0-9]{64}$/.test(token))return respond({error:"unauthorized"},401);
  // Never accept caller-controlled bootstrap/session hashes.
  delete payload.bootstrap_hash;delete payload.new_session_hash;
  let newToken: string|undefined;
  if(action==="bootstrap"){
   if(typeof payload.setup_code!=="string"||!/^[a-f0-9]{64}$/.test(payload.setup_code))return respond({error:"invalid_setup"},400);
   payload.bootstrap_hash=await sha256(payload.setup_code);delete payload.setup_code;
  }
  if(action==="bootstrap"||action==="login"){
   newToken=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,"0")).join("");
   payload.new_session_hash=await sha256(newToken);
  }
  const secrets=Deno.env.get("SUPABASE_SECRET_KEYS");
  const serverKey=secrets?JSON.parse(secrets).default:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!serverKey)return respond({error:"server_configuration"},503);
  const headers:Record<string,string>={apikey:serverKey,"Content-Type":"application/json"};
  if(serverKey.startsWith("eyJ"))headers.Authorization=`Bearer ${serverKey}`;
  if(action==='site.photo.upload'){
   const authorization=await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/onebite_access_api`,{method:'POST',headers,body:JSON.stringify({p_action:'site.photo.authorize',p_payload:{},p_session_hash:await sha256(token)})});
   if(!authorization.ok)return respond({error:'photo_upload_failed'},502);
   const authorized=await authorization.json();if(authorized.error)return respond({error:authorized.error},authorized.error==='unauthorized'?401:403);
   if(!/^[a-f0-9-]{36}$/.test(authorized.actor?.id??''))return respond({error:'photo_upload_failed'},502);
   if(typeof payload.image!=='string'||payload.image.length>950000||!payload.image.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.image))return respond({error:'invalid_photo'},400);
   let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(payload.image),c=>c.charCodeAt(0));}catch{return respond({error:'invalid_photo'},400);}
   if(bytes.length>750000||bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)return respond({error:'invalid_photo'},400);
   const photoPath=`${authorized.actor.id}/${crypto.randomUUID()}.jpg`;
   const stored=await fetch(`${Deno.env.get("SUPABASE_URL")}/storage/v1/object/site-photos/${photoPath}`,{method:'POST',headers:{...headers,'Content-Type':'image/jpeg','Cache-Control':'max-age=3600','x-upsert':'false'},body:bytes});
   if(!stored.ok)return respond({error:'photo_upload_failed'},502);
   return respond({photoPath});
  }
  const rpc=action==='activity.list'?'onebite_activity_page':'onebite_access_api';
  const response=await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/${rpc}`,{method:"POST",headers,body:JSON.stringify({...(action==='activity.list'?{}:{p_action:action}),p_payload:payload,p_session_hash:token?await sha256(token):null})});
  if(!response.ok){
   let code='unknown';try{const failure=await response.json();if(typeof failure.code==='string'&&/^[A-Z0-9_]{1,32}$/.test(failure.code))code=failure.code;}catch{}
   console.error(JSON.stringify({event:'admin_rpc_failed',action:requestAction,status:response.status,code}));
   return respond({error:"request_failed"},400);
  }
  const data=await response.json();
  if(data.error){const status=["unauthorized","invalid_credentials","invalid_api_key"].includes(data.error)?401:data.error==="forbidden"?403:data.error==="login_throttled"?429:data.error==="stale_revision"?409:400;const code=typeof data.error==='string'&&/^[a-z_]{1,40}$/.test(data.error)?data.error:'unknown';console.warn(JSON.stringify({event:'admin_action_rejected',action:requestAction,status,code}));return respond(data,status);}
  return respond(newToken?{...data,session:newToken}:data);
 }catch{console.error(JSON.stringify({event:'admin_request_failed',action:requestAction}));return respond({error:"invalid_request"},400);}
});
