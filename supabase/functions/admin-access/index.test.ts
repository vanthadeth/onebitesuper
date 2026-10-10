import jpeg from 'jpeg-js';
import {boundedBody,encodeBase32,totp,verifyTotp,sanitizeJpeg} from './security.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
let handler:(request:Request)=>Promise<Response>;
const env:Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_test'}),SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_server_only'})};
Object.assign(globalThis,{Deno:{env:{get:(key:string)=>env[key]},serve:(fn:typeof handler)=>{handler=fn;}}});
await import('./index.ts');
const request=(action:string,payload:Record<string,unknown>={},headers:Record<string,string>={})=>new Request('https://example.test/admin-access',{method:'POST',headers:{apikey:'sb_publishable_test','Content-Type':'application/json',...headers},body:JSON.stringify({action,payload})});
test('protected actions reject missing and malformed sessions before reaching the database',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected RPC');};
 try{for(const action of ['user.update','role.create','permissions.update','site.create','site.update','settings.update'])for(const headers of [{},{Authorization:'Bearer malformed'}]){const response=await handler(request(action,{},headers));assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'unauthorized'});}assert.equal(calls,0);}finally{globalThis.fetch=previous;}
});
test('login strips caller hashes, stores only a server-generated session hash and returns no server key',async()=>{
 const previous=globalThis.fetch;let rpc:Record<string,unknown>|undefined;
 globalThis.fetch=async(_url,init)=>{rpc=JSON.parse(init!.body as string);assert.equal(new Headers(init!.headers).get('apikey'),'sb_secret_server_only');return Response.json({actor:{id:'test'}});};
 try{const response=await handler(request('login',{username:'test',pin:'123456',new_session_hash:'attacker',bootstrap_hash:'attacker'}));assert.equal(response.status,200);const data=await response.json();assert.match(data.session,/^[a-f0-9]{64}$/);const payload=rpc!.p_payload as Record<string,unknown>;assert.equal(payload.bootstrap_hash,undefined);assert.match(payload.new_session_hash as string,/^[a-f0-9]{64}$/);assert.notEqual(payload.new_session_hash,data.session);assert.equal(JSON.stringify(data).includes('sb_secret'),false);}finally{globalThis.fetch=previous;}
});
test('invalid publishable keys and malformed setup codes cannot provision an Owner',async()=>{
 assert.equal((await handler(request('bootstrap.status',{}, {apikey:'unknown'}))).status,401);
 assert.equal((await handler(request('bootstrap',{setup_code:'guess'}))).status,400);
});
test('RPC failure diagnostics contain only action, status and error code',async()=>{
 const previous=globalThis.fetch,previousLog=console.error;const messages:string[]=[];console.error=(message:string)=>messages.push(message);
 globalThis.fetch=async()=>Response.json({code:'23505',message:'private username',details:'secret token'},{status:400});
 try{const response=await handler(request('user.update',{pin:'654321'},{Authorization:'Bearer '+ 'a'.repeat(64)}));assert.deepEqual(await response.json(),{error:'request_failed'});assert.deepEqual(JSON.parse(messages[0]),{event:'admin_rpc_failed',action:'user.update',status:400,code:'23505'});assert.equal(messages.join('').includes('654321'),false);assert.equal(messages.join('').includes('secret'),false);}finally{globalThis.fetch=previous;console.error=previousLog;}
});
const validJpeg=Buffer.from(jpeg.encode({data:Buffer.from([255,0,0,255]),width:1,height:1},80).data).toString('base64');
const uploadRequest=(image:string,token='a'.repeat(64))=>request('site.photo.upload',{image},{Authorization:'Bearer '+token});
test('site photos require authorization, validate image bytes and use server-only Storage credentials',async()=>{
 const previous=globalThis.fetch;const actorId='11111111-1111-4111-8111-111111111111';let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;const headers=new Headers(init!.headers);assert.equal(headers.get('apikey'),'sb_secret_server_only');if(String(url).includes('/rpc/onebite_orphan_photos'))return Response.json({paths:[]});if(String(url).includes('/rpc/')){const rpc=JSON.parse(init!.body as string);assert.equal(rpc.p_action,'site.photo.authorize');assert.match(rpc.p_session_hash,/^[a-f0-9]{64}$/);return Response.json({actor:{id:actorId}});}assert.match(String(url),new RegExp('/storage/v1/object/site-photos/'+actorId+'/[a-f0-9-]{36}\\.jpg$'));assert.equal(headers.get('Content-Type'),'image/jpeg');assert.equal(headers.get('x-upsert'),'false');const image=jpeg.decode(init!.body as Uint8Array);assert.equal(image.width,1);assert.equal(image.height,1);return Response.json({Key:'stored'});};
 try{const response=await handler(uploadRequest(validJpeg));assert.equal(response.status,200);const data=await response.json();assert.match(data.photoPath,new RegExp('^'+actorId+'/[a-f0-9-]{36}\\.jpg$'));assert.equal(calls,3);assert.equal(JSON.stringify(data).includes('sb_secret'),false);}finally{globalThis.fetch=previous;}
});
test('denied photo permissions and invalid images never upload; Storage failures are retryable',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'forbidden'});};
 try{assert.equal((await handler(uploadRequest(validJpeg))).status,403);assert.equal(calls,1);calls=0;assert.equal((await handler(uploadRequest(validJpeg,'bad'))).status,401);assert.equal(calls,0);
 globalThis.fetch=async(url)=>{if(String(url).includes('/rpc/'))return Response.json({actor:{id:'11111111-1111-4111-8111-111111111111'}});throw new Error('Invalid image reached Storage');};for(const image of ['cGxhaW4gdGV4dA==','<svg/>','!', 'A'.repeat(950001)])assert.equal((await handler(uploadRequest(image))).status,400);
 globalThis.fetch=async(url)=>String(url).includes('/rpc/')?Response.json({actor:{id:'11111111-1111-4111-8111-111111111111'}}):Response.json({private:'details'},{status:500});const response=await handler(uploadRequest(validJpeg));assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'photo_upload_failed'});
 }finally{globalThis.fetch=previous;}
});
test('activity reads use a separate protected paged RPC without forwarding action overrides',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://example.supabase.co/rest/v1/rpc/onebite_activity_page');const rpc=JSON.parse(init!.body as string);assert.equal(rpc.p_action,undefined);assert.deepEqual(rpc.p_payload,{start:'2026-10-01',end:'2026-10-09'});assert.match(rpc.p_session_hash,/^[a-f0-9]{64}$/);return Response.json({events:[],nextCursor:null});};
 try{assert.equal((await handler(request('activity.list'))).status,401);const response=await handler(request('activity.list',{start:'2026-10-01',end:'2026-10-09'},{Authorization:'Bearer '+'a'.repeat(64)}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{events:[],nextCursor:null});}finally{globalThis.fetch=previous;}
});
test('TOTP matches RFC 4226 vectors and accepts only the bounded time window',async()=>{
 const secret=encodeBase32(new TextEncoder().encode('12345678901234567890'));
 assert.equal(await totp(secret,0),'755224');assert.equal(await totp(secret,1),'287082');
 assert.equal(await verifyTotp(secret,'287082',30000),1);assert.equal(await verifyTotp(secret,'755224',120000),null);
});
test('body limit is applied to streamed bytes before parsing and JPEG marker-only uploads fail',async()=>{
 await assert.rejects(()=>boundedBody(new Request('https://example.test',{method:'POST',body:'x'.repeat(101)}),100),/payload_too_large/);
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(60));controller.enqueue(new Uint8Array(60));controller.close();}});
 await assert.rejects(()=>boundedBody(new Request('https://example.test',{method:'POST',body:stream,duplex:'half'} as RequestInit),100),/payload_too_large/);
 assert.throws(()=>sanitizeJpeg(new Uint8Array([255,216,255,217])));
});
test('CORS rejects untrusted origins and reflects only the production app origin',async()=>{
 const rejected=await handler(request('bootstrap.status',{}, {origin:'https://attacker.example'}));assert.equal(rejected.status,403);assert.equal(rejected.headers.get('Access-Control-Allow-Origin'),null);
 const response=await handler(new Request('https://example.test',{method:'OPTIONS',headers:{origin:'https://vanthadeth.github.io'}}));assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://vanthadeth.github.io');assert.equal(response.headers.get('Vary'),'Origin');
});
test('MFA enrollment secrets and verification counters cannot be injected by the browser',async()=>{
 const previous=globalThis.fetch;const seen:Record<string,unknown>[]=[];
 globalThis.fetch=async(_url,init)=>{const rpc=JSON.parse(init!.body as string);seen.push(rpc);return Response.json({secret:'A'.repeat(32),username:'staff'});};
 try{const result=await handler(request('mfa.enroll',{secret:'attacker',counter:99,_context:{source_hash:'attacker'}},{Authorization:'Bearer '+'a'.repeat(64)}));assert.equal(result.status,200);const payload=seen[0].p_payload as Record<string,unknown>;assert.match(payload.secret as string,/^[A-Z2-7]{32}$/);assert.notEqual(payload.secret,'attacker');assert.equal(payload.counter,undefined);assert.notEqual((payload._context as Record<string,unknown>).source_hash,'attacker');}finally{globalThis.fetch=previous;}
});

test('private profile photos use session authorization and sanitized server-only Storage writes',async()=>{
 const previous=globalThis.fetch,actorId='11111111-1111-4111-8111-111111111111';let storageWrites=0;
 globalThis.fetch=async(url,init)=>{assert.equal(new Headers(init!.headers).get('apikey'),'sb_secret_server_only');if(String(url).includes('/rpc/')){assert.match(String(url),/onebite_profile_photo_api$/);const body=JSON.parse(init!.body as string);assert.equal(body.p_action,'authorize');assert.match(body.p_session_hash,/^[a-f0-9]{64}$/);return Response.json({actor:{id:actorId},orphanPaths:[]});}storageWrites++;assert.match(String(url),new RegExp('/storage/v1/object/profile-photos/'+actorId+'/[a-f0-9-]{36}\\.jpg$'));assert.equal(new Headers(init!.headers).get('x-upsert'),'false');assert.equal(jpeg.decode(init!.body as Uint8Array).width,1);return Response.json({ok:true});};
 try{const response=await handler(request('profile.photo.upload',{image:validJpeg},{Authorization:'Bearer '+'a'.repeat(64)}));assert.equal(response.status,200);assert.match((await response.json()).photoPath,new RegExp('^'+actorId+'/'));assert.equal(storageWrites,1);
 globalThis.fetch=async()=>Response.json({error:'unauthorized'});assert.equal((await handler(request('profile.photo.read',{}, {Authorization:'Bearer '+'a'.repeat(64)}))).status,401);
 }finally{globalThis.fetch=previous;}
});
test('profile reads cannot select arbitrary paths and updates use a dedicated self-service RPC',async()=>{
 const previous=globalThis.fetch,path='11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg';
 globalThis.fetch=async(url,init)=>{if(String(url).includes('/rpc/')){const body=JSON.parse(init!.body as string);assert.equal(body.p_action,'read');return Response.json({photoPath:path});}assert.equal(String(url),'https://example.supabase.co/storage/v1/object/authenticated/profile-photos/'+path);return new Response(Buffer.from(validJpeg,'base64'));};
 try{const response=await handler(request('profile.photo.read',{photoPath:'attacker/path'},{Authorization:'Bearer '+'a'.repeat(64)}));assert.equal(response.status,200);assert.equal((await response.json()).photo,'data:image/jpeg;base64,'+validJpeg);
 globalThis.fetch=async(url,init)=>{assert.match(String(url),/onebite_profile_photo_api$/);const body=JSON.parse(init!.body as string);assert.equal(body.p_action,'update');assert.equal(body.p_payload.photoPath,null);assert.equal(body.p_payload.id,'target');return Response.json({error:'forbidden'});};assert.equal((await handler(request('profile.photo.update',{id:'target',photoPath:null,revision:1},{Authorization:'Bearer '+'a'.repeat(64)}))).status,403);
 }finally{globalThis.fetch=previous;}
});
