import type {CatalogItem} from './inventory.ts';
import {itemDefinition} from './inventory.ts';
import {createOperation,type Operation,type OperationScope,type JsonObject} from './operations.ts';
export type StockLine={itemId:string;quantity:string;unit:string};
export type StockPayload={lines:StockLine[];reference:string;remarks:string};
export type StockBalance={itemId:string;quantity:string;hasMovements:boolean};
export type StockMovement={id:string;operationId:string;itemId:string;name:string;nameEn:string;quantity:string;unit:string;kind:'stock.opening'|'stock.receive';actorName:string;postedAt:string;reference:string;remarks:string};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const scale=1_000_000n;
/** Exact material quantities in base units, six decimal places. Never sum binary floats. */
export function quantityMicros(value:string):bigint{
 if(typeof value!=='string'||!/^(-?)(0|[1-9]\d*)(\.\d{1,6})?$/.test(value)||value.length>30)throw new Error('invalid_stock_quantity');
 const negative=value.startsWith('-'),[whole,fraction='']=value.replace('-','').split('.');const result=BigInt(whole)*scale+BigInt(fraction.padEnd(6,'0'));return negative?-result:result;
}
export function quantityText(value:bigint){const negative=value<0n,absolute=negative?-value:value,whole=absolute/scale,fraction=(absolute%scale).toString().padStart(6,'0').replace(/0+$/,'');return (negative?'-':'')+whole+(fraction?'.'+fraction:'');}
export function formatQuantity(value:string){const [whole,fraction]=quantityText(quantityMicros(value)).split('.');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction?'.'+fraction:'');}
export function addQuantity(left:string,right:string){return quantityText(quantityMicros(left)+quantityMicros(right));}
export function directStockItem(item:CatalogItem){const definition=itemDefinition(item);return item.active&&['raw_material','supplies'].includes(definition.type)&&definition.lines.length===0;}
export function normalizeStockPayload(input:unknown):StockPayload{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('invalid_stock_payload');
 const payload=input as StockPayload;if(Object.keys(payload).sort().join(',')!=='lines,reference,remarks'||typeof payload.reference!=='string'||typeof payload.remarks!=='string'||payload.reference.length>100||payload.remarks.length>500||!Array.isArray(payload.lines)||!payload.lines.length||payload.lines.length>50)throw new Error('invalid_stock_payload');
 const seen=new Set<string>();const lines=payload.lines.map(line=>{if(!line||Object.keys(line).sort().join(',')!=='itemId,quantity,unit'||!uuid.test(line.itemId)||seen.has(line.itemId)||typeof line.unit!=='string'||!line.unit.trim()||line.unit.length>30)throw new Error('invalid_stock_payload');seen.add(line.itemId);const quantity=quantityMicros(line.quantity);if(quantity<=0n||quantity>1_000_000_000n*scale)throw new Error('invalid_stock_quantity');return {itemId:line.itemId,quantity:quantityText(quantity),unit:line.unit.trim()};});
 return {lines:lines.sort((a,b)=>a.itemId.localeCompare(b.itemId)),reference:payload.reference.trim(),remarks:payload.remarks.trim()};
}
export async function centralStockOperation(scope:OperationScope,kind:'stock.opening'|'stock.receive',input:StockPayload,items:CatalogItem[]):Promise<Operation>{
 if(scope.siteId!==null)throw new Error('invalid_scope');const payload=normalizeStockPayload(input);
 for(const line of payload.lines){const item=items.find(i=>i.id===line.itemId);if(!item||!directStockItem(item)||item.unit!==line.unit)throw new Error('invalid_stock_item');}
 return createOperation(scope,kind,payload as unknown as JsonObject);
}
/** Project only events not already included in the downloaded authoritative receipts. */
export function projectedStock(balances:StockBalance[],operations:Operation[],includedIds:string[]):StockBalance[]{
 const result=new Map(balances.map(b=>[b.itemId,{...b,quantity:quantityText(quantityMicros(b.quantity))}])),included=new Set(includedIds);
 for(const operation of operations){if(included.has(operation.id))continue;if(operation.siteId!==null||!['stock.opening','stock.receive'].includes(operation.kind))throw new Error('invalid_stock_operation');
  for(const line of normalizeStockPayload(operation.payload).lines){const current=result.get(line.itemId)??{itemId:line.itemId,quantity:'0',hasMovements:false};result.set(line.itemId,{...current,quantity:addQuantity(current.quantity,line.quantity),hasMovements:true});}
 }
 return [...result.values()];
}
