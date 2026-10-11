import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCatalogItem,validateCatalogItem,projectCatalog} from './inventory.ts';
test('material packs preserve explicit units and reject fractional pieces',()=>{
 const item={...newCatalogItem('material'),name:'Wrapper',packName:'Pack',packQuantity:100};
 assert.equal(validateCatalogItem(item).packQuantity,100);
 assert.throws(()=>validateCatalogItem({...item,packQuantity:1.5}));
 assert.equal(validateCatalogItem({...item,unit:'kg',packQuantity:1.5}).unit,'kg');
 assert.throws(()=>validateCatalogItem({...item,packQuantity:null}));
 assert.throws(()=>validateCatalogItem({...item,priceKhr:100}));
});
test('sellable records keep independent ids, prices and categories',()=>{
 const small={...newCatalogItem('sellable'),name:'Small box',category:'Dumplings',priceKhr:5000};
 const large={...newCatalogItem('sellable'),name:'Large box',category:'Dumplings',priceKhr:9000};
 assert.notEqual(small.id,large.id);assert.equal(validateCatalogItem(large).priceKhr,9000);
 assert.throws(()=>validateCatalogItem({...small,priceKhr:-1}));assert.throws(()=>validateCatalogItem({...small,priceKhr:0.5}));
});
test('pending edits survive refresh projection without erasing other items',()=>{
 const item={...newCatalogItem('sellable'),name:'Tea',category:'Drinks',revision:2};
 const updated={...item,name:'Lemon Tea'};
 const projected=projectCatalog([item],[{id:crypto.randomUUID(),item:updated,createdAt:Date.now()}]);
 assert.deepEqual(projected,[updated]);assert.equal(projected[0].revision,2);
});

test('reference values are validated and pending references survive projection',async()=>{
 const {newCatalogReference,validateCatalogReference,projectReferences}=await import('./inventory.ts');
 const reference={...newCatalogReference('unit'),name:' Kilograms ',value:' kg '};
 assert.equal(validateCatalogReference(reference).value,'kg');
 assert.equal(validateCatalogReference(reference).name,'Kilograms');
 assert.throws(()=>validateCatalogReference({...reference,active:false}));
 assert.throws(()=>validateCatalogReference({...reference,value:'x'.repeat(31)}));
 const operation={id:crypto.randomUUID(),reference,createdAt:Date.now()};
 assert.deepEqual(projectReferences([],[operation]),[reference]);
});

test('finished products expand into raw materials when composed into a sellable box',async()=>{
 const {validateRecipe,recipeMaterials}=await import('./inventory.ts');
 const wrapper={...newCatalogItem('material'),name:'Wrapper'};
 const filling={...newCatalogItem('material'),name:'Filling',unit:'g'};
 const box={...newCatalogItem('material'),name:'Paper box',category:'packaging'};
 const dumpling={...newCatalogItem('finished'),name:'Fried dumpling',category:'Dumplings',recipe:[{itemId:wrapper.id,quantity:1},{itemId:filling.id,quantity:3}]};
 const small={...newCatalogItem('sellable'),name:'Small box',category:'Dumplings',priceKhr:5000,recipe:[{itemId:dumpling.id,quantity:5},{itemId:box.id,quantity:1},{itemId:filling.id,quantity:2}]};
 const catalog=[wrapper,filling,box,dumpling,small];
 assert.equal(validateCatalogItem(dumpling).priceKhr,null);
 assert.deepEqual(recipeMaterials(small,catalog),[{itemId:wrapper.id,quantity:5},{itemId:filling.id,quantity:17},{itemId:box.id,quantity:1}]);
 assert.throws(()=>validateRecipe({...dumpling,recipe:[{itemId:wrapper.id,quantity:0.5}]},catalog));
 assert.throws(()=>validateRecipe({...dumpling,recipe:[{itemId:small.id,quantity:1}]},catalog));
 assert.throws(()=>validateRecipe({...dumpling,recipe:[{itemId:dumpling.id,quantity:1}]},catalog));
 assert.throws(()=>validateRecipe({...small,recipe:[{itemId:box.id,quantity:1},{itemId:box.id,quantity:2}]},catalog));
 assert.throws(()=>validateRecipe(small,catalog.map(item=>item.id===dumpling.id?{...item,active:false}:item)));
 assert.throws(()=>validateRecipe(small,catalog.map(item=>item.id===filling.id?{...item,active:false}:item)));
 assert.throws(()=>validateRecipe({...dumpling,recipe:[]},catalog));
 assert.throws(()=>validateRecipe({...small,recipe:[{itemId:filling.id,quantity:0.0001}]},catalog));
});

// Unified catalog: IDs stay independent of type and sale eligibility.
const unified=await import('./inventory.ts');
const raw={...unified.newUnifiedItem(),name:'Wrapper'};
const filler={...unified.newUnifiedItem(),name:'Filling',unit:'g'};
const sauce={...unified.newUnifiedItem(),name:'Sauce',unit:'ml'};sauce.definition!.conversions=[{unit:'g',factor:.8}];
const napkin={...unified.newUnifiedItem(),name:'Napkin'};napkin.definition!.type='supplies';
const dumpling={...unified.newUnifiedItem(),name:'Fried dumpling'};
dumpling.definition={...dumpling.definition!,type:'component',batchYield:10,lines:[{itemId:raw.id,quantity:10,unit:'pcs',section:'ingredients'},{itemId:filler.id,quantity:30,unit:'g',section:'ingredients'}]};
const box={...unified.newUnifiedItem(),name:'Small box',category:'main',unit:'box',priceKhr:5000};
box.definition={...box.definition!,type:'finished_good',canSell:true,lines:[{itemId:dumpling.id,quantity:5,unit:'pcs',section:'contents'},{itemId:sauce.id,quantity:3,unit:'g',section:'contents'},{itemId:napkin.id,quantity:2,unit:'pcs',section:'packaging'}]};
const allUnified=[raw,filler,sauce,napkin,dumpling,box];
assert.equal(unified.validateCatalogItem(raw).category,'');
assert.equal(unified.validateRecipe(box,allUnified).id,box.id);
assert.deepEqual(unified.recipeMaterials(box,allUnified),[{itemId:raw.id,quantity:5},{itemId:filler.id,quantity:15},{itemId:sauce.id,quantity:2.4},{itemId:napkin.id,quantity:2}]);
assert.equal(unified.convertItemQuantity(filler,3,'kg'),3000);
assert.throws(()=>unified.convertItemQuantity(filler,3,'ml'),/invalid_conversion/);
const cycle=structuredClone(dumpling);cycle.definition!.lines=[{itemId:box.id,quantity:1,unit:'box',section:'contents'}];
assert.throws(()=>unified.validateRecipe(box,[...allUnified.filter(i=>i.id!==dumpling.id),cycle]),/invalid_recipe/);
const old='2026-10-01T00:00:00.000Z',future='2026-10-12T00:00:00.000Z';
const versions=allUnified.map(item=>({item:{...item,revision:1},publishedAt:old,effectiveAt:old}));
const updated=structuredClone(dumpling);updated.revision=2;updated.definition!.lines[1].quantity=40;
versions.push({item:updated,publishedAt:old,effectiveAt:future});
const held=unified.snapshotItemForOrder(box.id,'2026-10-11T00:00:00.000Z',versions);
assert.equal(held.materials.find(line=>line.itemId===filler.id)?.quantity,15);
assert.equal(unified.snapshotItemForOrder(box.id,'2026-10-13T00:00:00.000Z',versions).materials.find(line=>line.itemId===filler.id)?.quantity,20);
updated.definition!.lines[1].quantity=99;
assert.equal(held.materials.find(line=>line.itemId===filler.id)?.quantity,15);
assert.equal(unified.fromCambodiaDateTime('2026-10-12T09:30'),'2026-10-12T02:30:00.000Z');
assert.equal(unified.cambodiaDateTime('2026-10-12T02:30:00.000Z'),'2026-10-12T09:30');
const ops=[box,dumpling,raw,filler,sauce,napkin].map(item=>({id:crypto.randomUUID(),item,createdAt:Date.now()}));
const sorted=unified.sortCatalogOperations(ops);assert.ok(sorted.findIndex(op=>op.item.id===raw.id)<sorted.findIndex(op=>op.item.id===dumpling.id));assert.ok(sorted.findIndex(op=>op.item.id===dumpling.id)<sorted.findIndex(op=>op.item.id===box.id));
