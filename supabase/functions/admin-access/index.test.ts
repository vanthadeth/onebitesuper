import test from 'node:test';
import assert from 'node:assert/strict';
let handler:(request:Request)=>Promise<Response>;
const env:Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_test'}),SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_server_only'})};
Object.assign(globalThis,{Deno:{env:{get:(key:string)=>env[key]},serve:(fn:typeof handler)=>{handler=fn;}}});
await import('./index.ts');
const request=(action:string,payload:Record<string,unknown>={},headers:Record<string,string>={})=>new Request('https://example.test/admin-access',{method:'POST',headers:{apikey:'sb_publishable_test','Content-Type':'application/json',...headers},body:JSON.stringify({action,payload})});
test('protected actions reject missing and malformed sessions before reaching the database',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected RPC');};
 try{for(const action of ['user.update','role.create','permissions.update'])for(const headers of [{},{Authorization:'Bearer malformed'}]){const response=await handler(request(action,{},headers));assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'unauthorized'});}assert.equal(calls,0);}finally{globalThis.fetch=previous;}
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
