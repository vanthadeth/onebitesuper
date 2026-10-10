import {test} from 'node:test';
import assert from 'node:assert/strict';
let handler:(request:Request)=>Promise<Response>;
const env:Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_test'}),SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_server_only'})};
Object.assign(globalThis,{Deno:{env:{get:(key:string)=>env[key]},serve:(fn:typeof handler)=>{handler=fn;}}});
await import('./index.ts');
const request=(action:string,payload:Record<string,unknown>={},headers:Record<string,string>={})=>new Request('https://example.test/inventory-access',{method:'POST',headers:{apikey:'sb_publishable_test','Content-Type':'application/json',...headers},body:JSON.stringify({action,payload})});
test('Inventory requires an opaque session and the configured public key before any RPC',async()=>{
 const original=fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected request');};
 try{for(const action of ['list','save','reference.save','photo.read']){const response=await handler(request(action));assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'unauthorized'});}const badKey=await handler(request('list',{}, {apikey:'bad',Authorization:'Bearer '+'1'.repeat(64)}));assert.equal(badKey.status,401);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('Inventory rejects foreign origins and oversized streamed bodies',async()=>{
 assert.equal((await handler(request('list',{}, {Origin:'https://untrusted.example'}))).status,403);
 const response=await handler(request('save',{image:'x'.repeat(1_000_001)},{Authorization:'Bearer '+'1'.repeat(64)}));assert.equal(response.status,413);
});
test('save forwards only operation fields and a server-generated content fingerprint',async()=>{
 const original=fetch;let rpc:Record<string,unknown>|undefined;
 globalThis.fetch=async(_url,init)=>{rpc=JSON.parse(init!.body as string);assert.equal(new Headers(init!.headers).get('apikey'),'sb_secret_server_only');return Response.json({item:{revision:1}});};
 try{const response=await handler(request('save',{id:'33333333-3333-4333-8333-333333333333',item:{name:'Wrapper'},fingerprint:'attacker',actor_id:'attacker',p_session_hash:'attacker'},{Authorization:'Bearer '+'1'.repeat(64)}));assert.equal(response.status,200);const payload=rpc!.p_payload as Record<string,unknown>;assert.deepEqual(Object.keys(payload).sort(),['confirmedActive','fingerprint','id','item']);assert.match(String(payload.fingerprint),/^[a-f0-9]{64}$/);assert.notEqual(rpc!.p_session_hash,'1'.repeat(64));assert.equal(JSON.stringify(await response.json()).includes('sb_secret'),false);}finally{globalThis.fetch=original;}
});
test('a denied photo read never reaches private Storage',async()=>{
 const original=fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'forbidden'});};
 try{const response=await handler(request('photo.read',{photoPath:'attacker/path.jpg'},{Authorization:'Bearer '+'1'.repeat(64)}));assert.equal(response.status,403);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('photo uploads require current Owner authorization before image processing or Storage',async()=>{
 const original=fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'forbidden'});};
 try{const response=await handler(request('save',{id:'33333333-3333-4333-8333-333333333333',item:{name:'Wrapper'},image:'data:image/jpeg;base64,invalid'},{Authorization:'Bearer '+'1'.repeat(64)}));assert.equal(response.status,403);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});

test('reference writes bind confirmation and content to a trusted fingerprint',async()=>{
 const original=fetch;let rpc:Record<string,unknown>|undefined;
 globalThis.fetch=async(_url,init)=>{rpc=JSON.parse(init!.body as string);return Response.json({reference:{revision:1}});};
 try{
  const reference={id:'44444444-4444-4444-8444-444444444444',kind:'unit',name:'Kilograms',value:'kg',active:true,revision:0};
  const response=await handler(request('reference.save',{id:'33333333-3333-4333-8333-333333333333',reference,confirmedActive:true,actor_id:'attacker',fingerprint:'attacker'},{Authorization:'Bearer '+'1'.repeat(64)}));
  assert.equal(response.status,200);assert.equal(rpc!.p_action,'reference.save');
  const payload=rpc!.p_payload as Record<string,unknown>;
  assert.deepEqual(Object.keys(payload).sort(),['confirmedActive','fingerprint','id','reference']);assert.equal(payload.confirmedActive,true);assert.match(String(payload.fingerprint),/^[a-f0-9]{64}$/);
 }finally{globalThis.fetch=original;}
});
