import {boundedBody,encodeBase32,verifyTotp,sanitizeJpeg} from './security.ts';
const actions=new Set(['bootstrap.status','bootstrap','login','logout','me','pin.change','user.create','user.update','sites.assign','site.create','site.update','site.photo.upload','settings.update','activity.list','permissions.update','role.create','pin.reset','mfa.enroll','mfa.verify']);
const sha256=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const randomHex=(length:number)=>[...crypto.getRandomValues(new Uint8Array(length))].map(v=>v.toString(16).padStart(2,'0')).join('');
declare const Deno:{env:{get(key:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
Deno.serve(async req=>{
 let requestAction='unknown';const requestId=crypto.randomUUID();
 const allowed=(Deno.env.get('ONEBITE_ALLOWED_ORIGINS')||'https://vanthadeth.github.io').split(',').map(v=>v.trim());
 const origin=req.headers.get('origin');const cors:Record<string,string>={'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 if(origin&&allowed.includes(origin))cors['Access-Control-Allow-Origin']=origin;
 const respond=(data:unknown,status=200)=>{if(status>=400){const raw=(data as {error?:unknown})?.error;const code=typeof raw==='string'&&/^[a-z_]{1,40}$/.test(raw)?raw:'unknown';console.warn(JSON.stringify({event:'admin_request_rejected',action:requestAction,status,code,request_id:requestId}));}return Response.json(data,{status,headers:cors});};
 if(origin&&!allowed.includes(origin))return respond({error:'forbidden'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
 try{
  const suppliedKey=req.headers.get('apikey'),publicKeys=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  const allowedPublic=[Deno.env.get('SUPABASE_ANON_KEY'),...(publicKeys?Object.values(JSON.parse(publicKeys)):[])];
  if(!suppliedKey||!allowedPublic.includes(suppliedKey))return respond({error:'invalid_api_key'},401);
  const raw=await boundedBody(req);const {action,payload={}}=JSON.parse(raw);
  if(typeof action!=='string'||!actions.has(action)||!payload||typeof payload!=='object'||Array.isArray(payload))return respond({error:'invalid_action'},400);
  requestAction=action;if(action!=='site.photo.upload'&&new TextEncoder().encode(raw).length>16000)return respond({error:'payload_too_large'},413);
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!['bootstrap.status','bootstrap','login'].includes(action)&&!/^[a-f0-9]{64}$/.test(token))return respond({error:'unauthorized'},401);
  // These fields are accepted only from trusted server code, never client payloads.
  for(const field of ['bootstrap_hash','new_session_hash','_context','secret','counter','recovery_hash','recovery_hashes'])delete payload[field];
  // Source throttling is defense in depth; global and per-account limits still apply if proxy headers vary.
  const source=req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown';
  const context={request_id:requestId,source_hash:await sha256(source)};
  payload._context=context;
  let newToken:string|undefined;
  if(action==='bootstrap'){
   if(typeof payload.setup_code!=='string'||!/^[a-f0-9]{64}$/.test(payload.setup_code))return respond({error:'invalid_setup'},400);
   payload.bootstrap_hash=await sha256(payload.setup_code);delete payload.setup_code;
  }
  if(action==='bootstrap'||action==='login'){newToken=randomHex(32);payload.new_session_hash=await sha256(newToken);}
  const secrets=Deno.env.get('SUPABASE_SECRET_KEYS');const serverKey=secrets?JSON.parse(secrets).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!serverKey)return respond({error:'server_configuration'},503);
  const headers:Record<string,string>={apikey:serverKey,'Content-Type':'application/json'};if(serverKey.startsWith('eyJ'))headers.Authorization=`Bearer ${serverKey}`;
  const sessionHash=token?await sha256(token):null;
  const rpc=async(name:string,body:Record<string,unknown>)=>{
   const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   if(!response.ok){let code='unknown';try{const failure=await response.json();if(typeof failure.code==='string'&&/^[A-Z0-9_]{1,32}$/.test(failure.code))code=failure.code;}catch{}
    console.error(JSON.stringify({event:'admin_rpc_failed',action:requestAction,status:response.status,code}));throw new Error('request_failed');}
   return response.json();
  };
  const api=(name:string,body:Record<string,unknown>={})=>rpc('onebite_access_api',{p_action:name,p_payload:{...body,_context:context},p_session_hash:sessionHash});
  let data;
  if(action==='mfa.enroll'){
   data=await api('mfa.enroll',{secret:encodeBase32(crypto.getRandomValues(new Uint8Array(20)))});
   if(!data.error)data={secret:data.secret,uri:`otpauth://totp/${encodeURIComponent('OneBite:'+data.username)}?secret=${data.secret}&issuer=OneBite&algorithm=SHA1&digits=6&period=30`};
  }else if(action==='mfa.verify'){
   if(typeof payload.code!=='string'||!/^([0-9]{6}|[a-f0-9]{16})$/.test(payload.code))return respond({error:'invalid_mfa'},400);
   const info=await api('mfa.context');if(info.error)data=info;else{
    const counter=await verifyTotp(info.secret,payload.code);
    const recoveryCodes=info.enrollment?Array.from({length:8},()=>randomHex(8)):[];
    data=await api('mfa.confirm',{counter,recovery_hash:/^[a-f0-9]{16}$/.test(payload.code)?await sha256(payload.code):null,recovery_hashes:await Promise.all(recoveryCodes.map(sha256))});
    if(!data.error&&recoveryCodes.length)data.recoveryCodes=recoveryCodes;
   }
  }else if(action==='site.photo.upload'){
   const authorization=await api('site.photo.authorize');if(authorization.error)data=authorization;else{
    if(!/^[a-f0-9-]{36}$/.test(authorization.actor?.id??''))return respond({error:'photo_upload_failed'},502);
    if(typeof payload.image!=='string'||payload.image.length>950000||!payload.image.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.image))return respond({error:'invalid_photo'},400);
    let bytes:Uint8Array;try{bytes=sanitizeJpeg(Uint8Array.from(atob(payload.image),c=>c.charCodeAt(0)));}catch{return respond({error:'invalid_photo'},400);}
    const photoPath=`${authorization.actor.id}/${crypto.randomUUID()}.jpg`;
    const stored=await fetch(`${Deno.env.get('SUPABASE_URL')}/storage/v1/object/site-photos/${photoPath}`,{method:'POST',headers:{...headers,'Content-Type':'image/jpeg','Cache-Control':'max-age=3600','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(15000)});
    if(!stored.ok)return respond({error:'photo_upload_failed'},502);data={photoPath};
    // Garbage collection is best effort; a maintenance outage must not lose a successful upload.
    try{const old=await rpc('onebite_orphan_photos',{p_session_hash:sessionHash});if(Array.isArray(old.paths)&&old.paths.length){const cleaned=await fetch(`${Deno.env.get('SUPABASE_URL')}/storage/v1/object/site-photos`,{method:'DELETE',headers,body:JSON.stringify({prefixes:old.paths}),signal:AbortSignal.timeout(5000)});if(!cleaned.ok)throw new Error('cleanup_failed');}}catch{console.warn(JSON.stringify({event:'photo_cleanup_failed'}));}
   }
  }else if(action==='activity.list')data=await rpc('onebite_activity_page',{p_payload:Object.fromEntries(Object.entries(payload).filter(([key])=>key!=='_context')),p_session_hash:sessionHash});
  else data=await api(action,payload);
  if(data.error){const status=['unauthorized','invalid_credentials'].includes(data.error)?401:data.error==='forbidden'?403:data.error==='login_throttled'?429:data.error==='stale_revision'?409:400;return respond(data,status);}
  return respond(newToken?{...data,session:newToken}:data);
 }catch(e){const code=e instanceof Error?e.message:'';if(code==='payload_too_large')return respond({error:code},413);if(code==='request_failed')return respond({error:code},400);
  console.error(JSON.stringify({event:'admin_request_failed',action:requestAction}));return respond({error:'invalid_request'},400);}
});
