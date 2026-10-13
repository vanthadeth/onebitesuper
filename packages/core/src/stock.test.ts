import test from 'node:test';
import assert from 'node:assert/strict';
import {newUnifiedItem} from './inventory.ts';
import {hasPermission} from './access.ts';
import {quantityMicros,quantityText,formatQuantity,addQuantity,centralStockOperation,normalizeStockPayload,projectedStock} from './stock.ts';
const material={...newUnifiedItem(),name:'Test flour',unit:'g',revision:1},scope={actorId:crypto.randomUUID(),siteId:null,deviceId:crypto.randomUUID()};
test('stock quantities add exactly and format the fraction without grouping its digits',()=>{
 assert.equal(addQuantity('0.1','0.2'),'0.3');assert.equal(quantityText(quantityMicros('1234.123456')),'1234.123456');assert.equal(formatQuantity('1234.123456'),'1,234.123456');assert.equal(addQuantity('1000000000','0.000001'),'1000000000.000001');for(const value of ['1e3','0.1234567','NaN','01','1,000',''])assert.throws(()=>quantityMicros(value),/invalid_stock_quantity/);
});
test('central posting validates scope, items, units, positive quantities and duplicate lines',async()=>{
 const input={lines:[{itemId:material.id,unit:'g',quantity:'1.000000'}],reference:' Supplier ',remarks:''};const op=await centralStockOperation(scope,'stock.receive',input,[material]);assert.equal((op.payload.lines as {quantity:string}[])[0].quantity,'1');assert.equal(op.payload.reference,'Supplier');assert.throws(()=>normalizeStockPayload({...input,lines:[...input.lines,...input.lines]}),/invalid_stock_payload/);assert.throws(()=>normalizeStockPayload({...input,lines:[{...input.lines[0],quantity:'0'}]}),/invalid_stock_quantity/);await assert.rejects(()=>centralStockOperation({...scope,siteId:0},'stock.receive',input,[material]),/invalid_scope/);await assert.rejects(()=>centralStockOperation(scope,'stock.receive',input,[{...material,active:false}]),/invalid_stock_item/);await assert.rejects(()=>centralStockOperation(scope,'stock.receive',input,[{...material,unit:'kg'}]),/invalid_stock_item/);
 const component={...material,definition:{...material.definition!,lines:[{itemId:crypto.randomUUID(),quantity:1,unit:'g',section:'ingredients' as const}]}};await assert.rejects(()=>centralStockOperation(scope,'stock.receive',input,[component]),/invalid_stock_item/);
});
test('server-included operations do not get counted again in local balances',async()=>{
 const op=await centralStockOperation(scope,'stock.receive',{lines:[{itemId:material.id,unit:'g',quantity:'0.2'}],reference:'',remarks:''},[material]);const balance=[{itemId:material.id,quantity:'0.1',hasMovements:true}];assert.equal(projectedStock(balance,[op],[])[0].quantity,'0.3');assert.equal(projectedStock(balance,[op],[op.id])[0].quantity,'0.1');assert.equal(balance[0].quantity,'0.1');assert.equal(hasPermission(['inventory.access','stock.opening'],'Cashier','stock.opening'),false);assert.equal(hasPermission(['inventory.access','stock.receive'],'Cashier','stock.receive'),true);assert.equal(hasPermission(['stock.receive'],'Cashier','stock.receive'),false);
});
