import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCatalogItem,validateCatalogItem,projectCatalog} from './inventory.ts';
test('material packs preserve explicit units and reject fractional pieces',()=>{
 const item={...newCatalogItem('material'),name:'Wrapper',packName:'Pack',packQuantity:100};
 assert.equal(validateCatalogItem(item).packQuantity,100);
 assert.throws(()=>validateCatalogItem({...item,packQuantity:1.5}));
 assert.throws(()=>validateCatalogItem({...item,unit:'kg'}));
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
