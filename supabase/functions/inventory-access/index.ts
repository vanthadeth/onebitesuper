import {boundedBody,sanitizeJpeg} from '../admin-access/security.ts';
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
const actions=new Set(['list','save','reference.save','photo.read']);
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
  const raw=await boundedBody(req),body=JSON.parse(raw);
  if(!actions.has(body.action)||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload))return respond({error:'invalid_action'},400);
  if(body.action!=='save'&&new TextEncoder().encode(raw).length>16000)return respond({error:'payload_too_large'},413);
  const secrets=Deno.env.get('SUPABASE_SECRET_KEYS'),key=secrets?JSON.parse(secrets).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!key)return respond({error:'server_configuration'},503);
  const serviceHeaders:Record<string,string>={apikey:key,'Content-Type':'application/json'};if(key.startsWith('eyJ'))serviceHeaders.Authorization=`Bearer ${key}`;
  const sessionHash=await hash(token),url=Deno.env.get('SUPABASE_URL');
  const rpc=async(action:string,payload:Record<string,unknown>)=>{
   const response=await fetch(`${url}/rest/v1/rpc/onebite_inventory_api`,{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_action:action,p_payload:payload,p_session_hash:sessionHash}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('request_failed');return response.json();
  };
  let result;
  if(body.action==='save'){
   const {id,item,image}=body.payload;
   if(typeof id!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/).test(id)||!item||typeof item!=='object'||Array.isArray(item)||!(image===undefined||image===null||typeof image==='string'))return respond({error:'invalid_item'},400);
   // Only these trusted fields cross into SQL. Fingerprint binds every retry to its content.
   const payload={id,item:{...item},confirmedActive:body.payload.confirmedActive===true,fingerprint:await hash(JSON.stringify({id,item,image:image??null,...(body.payload.confirmedActive===true?{confirmedActive:true}:{})}))};
   if(typeof image==='string'){
    const authorization=await rpc('photo.authorize',{});if(authorization.error)result=authorization;else{
     if(image.length>950000||!image.startsWith('data:image/jpeg;base64,'))return respond({error:'invalid_photo'},400);
     let bytes:Uint8Array;try{bytes=sanitizeJpeg(Uint8Array.from(atob(image.slice('data:image/jpeg;base64,'.length)),char=>char.charCodeAt(0)));}catch{return respond({error:'invalid_photo'},400);}
     const path=`${authorization.actor.id}/${id}.jpg`;
     // Immutable operation path: upload retries cannot overwrite an earlier image.
     const stored=await fetch(`${url}/storage/v1/object/catalog-photos/${path}`,{method:'POST',headers:{...serviceHeaders,'Content-Type':'image/jpeg','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(15000)});
     if(!stored.ok){const failure=await stored.json().catch(()=>({}));if(String(failure.statusCode)!=='409'&&failure.error!=='Duplicate')return respond({error:'photo_upload_failed'},502);
      const existing=await fetch(`${url}/storage/v1/object/authenticated/catalog-photos/${path}`,{headers:serviceHeaders,signal:AbortSignal.timeout(15000)});
      if(!existing.ok)return respond({error:'photo_upload_failed'},502);const previous=new Uint8Array(await existing.arrayBuffer());
      if(previous.length!==bytes.length||previous.some((byte,index)=>byte!==bytes[index]))return respond({error:'operation_conflict'},409);
     }
     payload.item.photoPath=path;result=await rpc('save',payload);
    }
   }else{if(image===null)payload.item.photoPath=null;result=await rpc('save',payload);}
  }else if(body.action==='reference.save'){
   const {id,reference}=body.payload;
   if(typeof id!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/).test(id)||!reference||typeof reference!=='object'||Array.isArray(reference))return respond({error:'invalid_reference'},400);
   const confirmedActive=body.payload.confirmedActive===true;
   result=await rpc('reference.save',{id,reference,confirmedActive,fingerprint:await hash(JSON.stringify({action:'reference.save',id,reference,confirmedActive}))});
  }else if(body.action==='photo.read'){
   result=await rpc('photo.read',{photoPath:body.payload.photoPath});if(!result.error){
    const response=await fetch(`${url}/storage/v1/object/authenticated/catalog-photos/${result.photoPath}`,{headers:serviceHeaders,signal:AbortSignal.timeout(15000)});
    if(!response.ok)return respond({error:'photo_read_failed'},502);
    const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>750000)return respond({error:'invalid_photo'},400);
    let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);result={photo:'data:image/jpeg;base64,'+btoa(binary)};
   }
  }else result=await rpc('list',{});
  if(result.error)return respond(result,result.error==='unauthorized'?401:result.error==='forbidden'?403:['stale_revision','operation_conflict','duplicate_item','duplicate_reference','inactive_reference','confirmation_required'].includes(result.error)?409:400);
  return respond(result);
 }catch(error){const code=error instanceof Error?error.message:'';if(code==='payload_too_large')return respond({error:code},413);console.warn(JSON.stringify({event:'inventory_request_failed'}));return respond({error:'request_failed'},400);}
});
