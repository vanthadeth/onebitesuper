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
