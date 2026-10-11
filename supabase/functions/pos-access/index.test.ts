import {test} from 'node:test';
import assert from 'node:assert/strict';
let handler:(request:Request)=>Promise<Response>;
const env:Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_test'}),SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_server_only'})};
Object.assign(globalThis,{Deno:{env:{get:(key:string)=>env[key]},serve:(fn:typeof handler)=>{handler=fn;}}});
await import('./index.ts');
const request=(action:string,payload:Record<string,unknown>={},headers:Record<string,string>={})=>new Request('https://example.test/pos-access',{method:'POST',headers:{apikey:'sb_publishable_test','Content-Type':'application/json',...headers},body:JSON.stringify({action,payload})});
test('POS rejects anonymous sessions, unconfigured keys, foreign origins and oversized bodies',async()=>{
 const original=fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected RPC');};
 try{assert.equal((await handler(request('bootstrap'))).status,401);assert.equal((await handler(request('bootstrap',{}, {apikey:'bad',Authorization:'Bearer '+'1'.repeat(64)}))).status,401);assert.equal((await handler(request('bootstrap',{}, {Origin:'https://untrusted.example'}))).status,403);assert.equal((await handler(request('bootstrap',{large:'x'.repeat(17000)},{Authorization:'Bearer '+'1'.repeat(64)}))).status,413);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('bootstrap derives the session hash and strips caller-supplied roles and sites',async()=>{
 const original=fetch;let body:Record<string,unknown>|undefined;
 globalThis.fetch=async(_url,init)=>{body=JSON.parse(init!.body as string);assert.equal(new Headers(init!.headers).get('apikey'),'sb_secret_server_only');return Response.json({actor:{role:'Cashier'},sites:[]});};
 try{const response=await handler(request('bootstrap',{role:'Owner',siteId:123,p_session_hash:'attacker'},{Authorization:'Bearer '+'1'.repeat(64)}));assert.equal(response.status,200);assert.equal(body!.p_action,'bootstrap');assert.deepEqual(body!.p_payload,{});assert.notEqual(body!.p_session_hash,'1'.repeat(64));assert.match(String(body!.p_session_hash),/^[a-f0-9]{64}$/);}finally{globalThis.fetch=original;}
});
test('a denied catalog photo cannot reach private Storage; mutations are unavailable',async()=>{
 const original=fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'forbidden'});};
 try{assert.equal((await handler(request('photo.read',{photoPath:'11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg'},{Authorization:'Bearer '+'1'.repeat(64)}))).status,403);assert.equal(calls,1);assert.equal((await handler(request('payment.record',{}, {Authorization:'Bearer '+'1'.repeat(64)}))).status,400);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
