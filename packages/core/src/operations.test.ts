import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperation,validateOperation,canonicalJson,pendingOperation,replayOperations,OperationTransportError,type Operation,type OperationRecord,type OperationStore,type OperationScope,type OperationReceipt} from './operations.ts';
const scope:OperationScope={actorId:crypto.randomUUID(),siteId:0,deviceId:crypto.randomUUID()},time='2026-10-13T06:00:00Z';
function memory(records:OperationRecord[]):OperationStore{return {list:async()=>structuredClone(records),update:async(_,id,revision,change)=>{const index=records.findIndex(r=>r.operation.id===id);assert.equal(records[index].revision,revision);records[index]={...change(structuredClone(records[index])),revision:revision+1};return structuredClone(records[index]);}};}
const receipt=(op:Operation):OperationReceipt=>({id:op.id,fingerprint:op.fingerprint,reference:'posted:'+op.id,acknowledgedAt:time});
test('fingerprints are deterministic and freeze nested caller data',async()=>{
 const payload={items:[{item:'wrapper',quantity:'100.000'}],note:'receipt'},options={id:crypto.randomUUID(),createdAt:time};
 const operation=await createOperation(scope,'stock.receive',payload,options);payload.items[0].quantity='1.000';assert.equal((operation.payload.items as {quantity:string}[])[0].quantity,'100.000');
 const same=await createOperation(scope,'stock.receive',{note:'receipt',items:[{quantity:'100.000',item:'wrapper'}]},options);assert.equal(operation.fingerprint,same.fingerprint);await validateOperation(same,scope);
 const changed={...same,payload:{note:'another payload'}};await assert.rejects(()=>validateOperation(changed,scope),/operation_conflict/);await assert.rejects(()=>validateOperation(same,{...scope,siteId:1}),/scope_mismatch/);
});
test('non-JSON, invalid scope and oversized payloads are rejected',async()=>{
 for(const value of [undefined,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,new Date(),{x:undefined},1n])assert.throws(()=>canonicalJson(value),/invalid_payload/);
 await assert.rejects(()=>createOperation({...scope,siteId:-1},'stock.receive',{}),/invalid_scope/);
 await assert.rejects(()=>createOperation(scope,'stock.receive',{note:'x'.repeat(256000)}),/payload_too_large/);
 const id=crypto.randomUUID();await assert.rejects(()=>createOperation(scope,'stock.receive',{}, {id,dependencies:[id]}),/invalid_operation/);
});
test('dependencies acknowledge first even when supplied out of order',async()=>{
 const parent=await createOperation(scope,'stock.opening',{}),child=await createOperation(scope,'stock.receive',{}, {dependencies:[parent.id]}),records=[pendingOperation(child),pendingOperation(parent)],sent:string[]=[];
 const result=await replayOperations({scope,store:memory(records),authorize:async()=>true,send:async op=>{sent.push(op.id);return receipt(op);}});assert.deepEqual(sent,[parent.id,child.id]);assert.equal(result.pending,0);assert.equal(result.processed,2);
});
test('lost responses retry the original operation and do not duplicate server effects',async()=>{
 const op=await createOperation(scope,'stock.receive',{quantity:'100'}),records=[pendingOperation(op)],posted=new Map<string,OperationReceipt>();let calls=0,clock=1000;
 const send=async(value:Operation)=>{calls++;if(!posted.has(value.id))posted.set(value.id,receipt(value));if(calls===1)throw new Error('response lost');return posted.get(value.id)!;};
 const options={scope,store:memory(records),authorize:async()=>true,send,now:()=>clock};await replayOperations(options);assert.equal(records[0].status,'pending');assert.equal(records[0].retryAt,2000);await replayOperations(options);assert.equal(calls,1);clock=2000;await replayOperations(options);assert.equal(calls,2);assert.equal(posted.size,1);assert.equal(records[0].status,'acknowledged');assert.equal(records[0].attempts,2);
});
test('a persisted sending operation can recover after a restart',async()=>{
 const op=await createOperation(scope,'stock.receive',{}),record={...pendingOperation(op),status:'sending' as const,attempts:1},records=[record];
 await replayOperations({scope,store:memory(records),authorize:async()=>true,send:async value=>{assert.equal(value.id,op.id);return receipt(value);}});assert.equal(records[0].attempts,2);assert.equal(records[0].status,'acknowledged');
});
test('authorization is rechecked for every operation and does not discard unsent work',async()=>{
 const records=[pendingOperation(await createOperation(scope,'stock.receive',{})),pendingOperation(await createOperation(scope,'stock.receive',{}))];let checks=0,calls=0;
 const result=await replayOperations({scope,store:memory(records),authorize:async()=>++checks===1,send:async op=>{calls++;return receipt(op);}});assert.equal(calls,1);assert.equal(result.stopped,'auth_required');assert.equal(records[1].status,'pending');assert.equal(records[1].attempts,0);
});
test('invalid receipts go to review, block dependents and allow independent operations',async()=>{
 const first=await createOperation(scope,'stock.opening',{}),child=await createOperation(scope,'stock.receive',{}, {dependencies:[first.id]}),other=await createOperation(scope,'stock.receive',{}),records=[first,child,other].map(pendingOperation),sent:string[]=[];
 const result=await replayOperations({scope,store:memory(records),authorize:async()=>true,send:async op=>{sent.push(op.id);return op.id===first.id?{...receipt(op),fingerprint:'wrong'}:receipt(op);}});assert.equal(records[0].status,'review');assert.equal(records[1].status,'pending');assert.equal(records[2].status,'acknowledged');assert.deepEqual(sent,[first.id,other.id]);assert.equal(result.review,1);
});
test('auth transport errors stop replay and retain payloads without raw error messages',async()=>{
 const records=[pendingOperation(await createOperation(scope,'stock.receive',{privateNote:'retain'}))];const result=await replayOperations({scope,store:memory(records),authorize:async()=>true,send:async()=>{throw new OperationTransportError('auth','unauthorized');}});assert.equal(result.stopped,'unauthorized');assert.equal(records[0].status,'pending');assert.equal(records[0].operation.payload.privateNote,'retain');assert.equal(records[0].lastError,'unauthorized');
});
test('failed persistence of an acknowledgment propagates without converting it to a retry failure',async()=>{
 const records=[pendingOperation(await createOperation(scope,'stock.receive',{}))],store=memory(records),update=store.update;store.update=async(...args)=>{if(args[2]===1)throw new Error('storage_failed');return update(...args);};
 await assert.rejects(()=>replayOperations({scope,store,authorize:async()=>true,send:async op=>receipt(op)}),/storage_failed/);assert.equal(records[0].status,'sending');assert.equal(records[0].lastError,null);
});
