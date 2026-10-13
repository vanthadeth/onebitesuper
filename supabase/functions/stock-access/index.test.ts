import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperation} from '../../../packages/core/src/operations.ts';
let handler:(req:Request)=>Promise<Response>;
const env:Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_test'}),SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_test'})};
Object.assign(globalThis,{Deno:{env:{get:(key:string)=>env[key]},serve:(fn:typeof handler)=>handler=fn}});await import('./index.ts');
const request=(action:string,payload:unknown={},headers:Record<string,string>={})=>new Request('https://example.test',{method:'POST',headers:{apikey:'sb_publishable_test',Authorization:'Bearer '+'1'.repeat(64),'Content-Type':'application/json',...headers},body:JSON.stringify({action,payload})});
test('stock API checks origin and opaque authentication before contacting the database',async()=>{
 const original=fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error();};try{assert.equal((await handler(request('list',{}, {Authorization:''}))).status,401);assert.equal((await handler(request('list',{}, {apikey:'bad'}))).status,401);assert.equal((await handler(request('list',{}, {Origin:'https://foreign.example'}))).status,403);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('posting rejects mutated operations and unsupported site/financial events',async()=>{
 const op=await createOperation({actorId:crypto.randomUUID(),deviceId:crypto.randomUUID(),siteId:null},'stock.receive',{lines:[{itemId:crypto.randomUUID(),unit:'g',quantity:'1'}],reference:'',remarks:''});assert.equal((await handler(request('post',{operation:{...op,payload:{...op.payload,remarks:'tampered'}}}))).status,400);const financial=await createOperation({actorId:op.actorId,deviceId:op.deviceId,siteId:0},'order.complete',{});assert.equal((await handler(request('post',{operation:financial}))).status,400);assert.equal((await handler(request('post',{operation:null}))).status,400);
});
test('validated envelopes forward only trusted RPC parameters, with a derived session hash',async()=>{
 const op=await createOperation({actorId:crypto.randomUUID(),deviceId:crypto.randomUUID(),siteId:null},'stock.receive',{lines:[{itemId:crypto.randomUUID(),unit:'g',quantity:'1'}],reference:'',remarks:''});const original=fetch;let body:any;
 globalThis.fetch=async(_url,init)=>{body=JSON.parse(init!.body as string);assert.equal(new Headers(init!.headers).get('apikey'),'sb_secret_test');return Response.json({id:op.id,fingerprint:op.fingerprint,reference:'ST-test',acknowledgedAt:new Date().toISOString()});};try{const response=await handler(request('post',{operation:op,actor_id:'attacker',p_session_hash:'attacker'}));assert.equal(response.status,200);assert.deepEqual(Object.keys(body.p_payload),['operation']);assert.deepEqual(body.p_payload.operation,op);assert.match(body.p_session_hash,/^[a-f0-9]{64}$/);assert.notEqual(body.p_session_hash,'1'.repeat(64));assert.equal(JSON.stringify(await response.json()).includes('sb_secret'),false);}finally{globalThis.fetch=original;}
});
