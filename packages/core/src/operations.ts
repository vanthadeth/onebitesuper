/** Transport-independent foundation. Server posting must authorize and validate each business kind. */
export type JsonValue=null|boolean|number|string|JsonValue[]|{[key:string]:JsonValue};
export type JsonObject={[key:string]:JsonValue};
export type OperationKind='stock.opening'|'stock.receive'|'stock.waste'|'stock.count'|'stock.dispatch'|'stock.receive_delivery'|'order.complete'|'shift.open'|'cash.transfer';
export type OperationScope={actorId:string;siteId:number|null;deviceId:string};
export type Operation=OperationScope&{schema:1;id:string;kind:OperationKind;shiftId:string|null;createdAt:string;dependencies:string[];payload:JsonObject;fingerprint:string};
export type OperationReceipt={id:string;fingerprint:string;reference:string;acknowledgedAt:string};
export type OperationRecord={operation:Operation;revision:number;status:'pending'|'sending'|'acknowledged'|'review';attempts:number;retryAt:number;lastError:string|null;receipt:OperationReceipt|null};
const kinds:OperationKind[]=['stock.opening','stock.receive','stock.waste','stock.count','stock.dispatch','stock.receive_delivery','order.complete','shift.open','cash.transfer'];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function canonicalJson(value:unknown,depth=0):string{
 if(depth>20)throw new Error('invalid_payload');
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER)return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(item=>canonicalJson(item,depth+1)).join(',')+']';
 if(typeof value==='object'&&value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJson((value as Record<string,unknown>)[key],depth+1)).join(',')+'}';
 throw new Error('invalid_payload');
}
export function validateScope(scope:OperationScope){if(!uuid.test(scope.actorId)||!uuid.test(scope.deviceId)||(scope.siteId!==null&&(!Number.isSafeInteger(scope.siteId)||scope.siteId<0)))throw new Error('invalid_scope');}
export function matchesScope(operation:Operation,scope:OperationScope){return operation.actorId===scope.actorId&&operation.siteId===scope.siteId&&operation.deviceId===scope.deviceId;}
async function fingerprint(value:unknown){const bytes=new TextEncoder().encode(canonicalJson(value));if(bytes.length>256_000)throw new Error('payload_too_large');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');}
function validateEnvelope(operation:Omit<Operation,'fingerprint'>){
 validateScope(operation);
 if(operation.schema!==1||!uuid.test(operation.id)||!kinds.includes(operation.kind)||operation.shiftId!==null&&!uuid.test(operation.shiftId)||!Number.isFinite(Date.parse(operation.createdAt))||!Array.isArray(operation.dependencies)||operation.dependencies.length>100||new Set(operation.dependencies).size!==operation.dependencies.length||operation.dependencies.some(id=>!uuid.test(id)||id===operation.id)||!operation.payload||Array.isArray(operation.payload)||typeof operation.payload!=='object')throw new Error('invalid_operation');
 if(Object.keys(operation).sort().join(',')!=='actorId,createdAt,dependencies,deviceId,id,kind,payload,schema,shiftId,siteId')throw new Error('invalid_operation');
}
export async function createOperation(scope:OperationScope,kind:OperationKind,payload:JsonObject,options:{id?:string;shiftId?:string|null;dependencies?:string[];createdAt?:string}={}):Promise<Operation>{
 const value={schema:1 as const,...scope,id:options.id??crypto.randomUUID(),kind,shiftId:options.shiftId??null,createdAt:options.createdAt??new Date().toISOString(),dependencies:options.dependencies??[],payload};validateEnvelope(value);const sealed=JSON.parse(canonicalJson(value));
 const digest=await fingerprint(sealed);return {...sealed,fingerprint:digest};
}
export async function validateOperation(operation:Operation,scope:OperationScope){
 const {fingerprint:digest,...envelope}=operation;validateEnvelope(envelope);
 if(!matchesScope(operation,scope))throw new Error('operation_scope_mismatch');
 if(!/^[a-f0-9]{64}$/.test(digest)||await fingerprint(envelope)!==digest)throw new Error('operation_conflict');
}
export function pendingOperation(operation:Operation):OperationRecord{return {operation,revision:0,status:'pending',attempts:0,retryAt:0,lastError:null,receipt:null};}
export class OperationTransportError extends Error{
 category:'retry'|'auth'|'review';code:string;
 constructor(category:'retry'|'auth'|'review',code:string){super(category);this.category=category;this.code=code;if(!/^[a-z_]{1,60}$/.test(code))throw new Error('invalid_error_code');}
}
export type OperationStore={list:(scope:OperationScope)=>Promise<OperationRecord[]>;update:(scope:OperationScope,id:string,revision:number,change:(record:OperationRecord)=>OperationRecord)=>Promise<OperationRecord>};
export function outboxSummary(records:OperationRecord[]){return {pending:records.filter(r=>r.status==='pending'||r.status==='sending').length,review:records.filter(r=>r.status==='review').length,acknowledged:records.filter(r=>r.status==='acknowledged').length};}
/** At-least-once delivery: the backend must atomically enforce ID+fingerprint idempotency. No sleeps. */
export async function replayOperations({scope,store,authorize,send,now=Date.now}:{scope:OperationScope;store:OperationStore;authorize:()=>Promise<boolean>;send:(operation:Operation)=>Promise<OperationReceipt>;now?:()=>number}){
 validateScope(scope);const attempted=new Set<string>();let acknowledged=0;
 for(;;){
  const records=await store.list(scope),done=new Set(records.filter(r=>r.status==='acknowledged').map(r=>r.operation.id));
  const candidate=records.find(r=>(r.status==='pending'||r.status==='sending')&&r.retryAt<=now()&&!attempted.has(r.operation.id)&&r.operation.dependencies.every(id=>done.has(id)));
  if(!candidate)return {processed:acknowledged,stopped:null,...outboxSummary(records)};
  await validateOperation(candidate.operation,scope);
  if(!await authorize())return {processed:acknowledged,stopped:'auth_required',...outboxSummary(records)};
  const sending=await store.update(scope,candidate.operation.id,candidate.revision,r=>({...r,status:'sending',attempts:r.attempts+1,lastError:null}));attempted.add(sending.operation.id);
  let receipt:OperationReceipt;
  try{
   receipt=await send(sending.operation);
   if(!receipt||receipt.id!==sending.operation.id||receipt.fingerprint!==sending.operation.fingerprint||typeof receipt.reference!=='string'||!receipt.reference.trim()||receipt.reference.length>200||!Number.isFinite(Date.parse(receipt.acknowledgedAt)))throw new OperationTransportError('review','invalid_receipt');
  }catch(error){
   const failure=error instanceof OperationTransportError?error:new OperationTransportError('retry','network_failed');
   await store.update(scope,sending.operation.id,sending.revision,r=>({...r,status:failure.category==='review'?'review':'pending',lastError:failure.code,retryAt:failure.category==='retry'?now()+Math.min(60_000,1000*2**Math.min(r.attempts-1,6)):0}));
   if(failure.category!=='review')return {processed:acknowledged,stopped:failure.code,...outboxSummary(await store.list(scope))};
   continue;
  }
  // Persistence errors propagate; never reinterpret a failed local acknowledgment as a server rejection.
  await store.update(scope,sending.operation.id,sending.revision,r=>({...r,status:'acknowledged',receipt,retryAt:0,lastError:null}));acknowledged++;
 }
}
