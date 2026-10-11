import test from 'node:test';
import assert from 'node:assert/strict';
import {newUnifiedItem,type ItemVersion} from './inventory.ts';
import {emptyWorkspace,addDraftItem,addConfiguredDraftItem,effectiveMenu,holdDraft,resumeDraft,cancelDraft,draftAmounts,cashEquivalent} from './pos.ts';
const time='2026-10-11T06:00:00Z',published='2026-10-10T00:00:00Z';
const raw={...newUnifiedItem(),name:'Raw',unit:'pcs',revision:1};
const box={...newUnifiedItem(),name:'Box',unit:'box',priceKhr:5050,revision:1};box.definition={...box.definition!,type:'finished_good',canSell:true,effectiveAt:published,lines:[{itemId:raw.id,quantity:5,unit:'pcs',section:'contents'}]};
const versions:ItemVersion[]=[raw,box].map(item=>({item,publishedAt:published,effectiveAt:published}));
test('menu uses effective published versions and excludes non-sellable and future items',()=>{
 const future={...box,id:crypto.randomUUID(),name:'Future'};assert.deepEqual(effectiveMenu([...versions,{item:future,effectiveAt:'2026-10-12T00:00:00Z',publishedAt:published}],time).map(i=>i.name),['Box']);
});
test('first item locks recipe and price for subsequent edits and held carts',()=>{
 const workspace=emptyWorkspace(0),current=addDraftItem(workspace.current,box.id,versions,1,time);assert.equal(current.startedAt,time);assert.deepEqual(current.lines[0].materials,[{itemId:raw.id,quantity:5}]);
 const newer={...box,priceKhr:9000,revision:2,definition:{...box.definition!,lines:[{itemId:raw.id,quantity:10,unit:'pcs',section:'contents' as const}]}};
 const next=addDraftItem(current,box.id,[...versions,{item:newer,effectiveAt:'2026-10-11T07:00:00Z',publishedAt:'2026-10-11T07:00:00Z'}],1,'2026-10-11T08:00:00Z');assert.equal(next.lines[0].quantity,2);assert.equal(next.lines[0].item.priceKhr,5050);assert.equal(next.lines[0].materials[0].quantity,5);assert.equal(draftAmounts(next).total,10100);assert.equal(draftAmounts(current).rounding,50);
 box.name='Changed outside';assert.equal(current.lines[0].item.name,'Box');
});
test('holding starts blank, opening a held cart preserves the current nonblank cart',()=>{
 let w=emptyWorkspace(0);w={...w,current:addDraftItem(w.current,box.id,versions,1,time)};const id=w.current.id;w=holdDraft(w);assert.equal(w.current.lines.length,0);assert.equal(w.held.length,1);w={...w,current:addDraftItem(w.current,box.id,versions,2,time)};const other=w.current.id;w=resumeDraft(w,id);assert.equal(w.current.id,id);assert.equal(w.held[0].id,other);assert.equal(w.held[0].lines[0].quantity,2);
 assert.throws(()=>cancelDraft(w,id,' '),/reason_required/);const cancelled=cancelDraft(w,id,'Customer changed mind',time);assert.equal(cancelled.current.lines.length,0);assert.equal(cancelled.cancelled[0].reason,'Customer changed mind');assert.equal(w.current.lines.length,1);
});
test('invalid quantities and currency values cannot enter draft totals',()=>{assert.throws(()=>addDraftItem(emptyWorkspace(0).current,box.id,versions,0,time),/invalid_quantity/);assert.throws(()=>addDraftItem(emptyWorkspace(0).current,box.id,versions,1000,time),/invalid_quantity/);assert.equal(cashEquivalent(20000,2.5,4000),30000);assert.throws(()=>cashEquivalent(-1,2,4000),/invalid_amount/);});

test('configured additions preserve separate remarks and lock price and ingredients',()=>{
 const current=addDraftItem(emptyWorkspace(0).current,box.id,versions,1,time);
 const newer={...box,priceKhr:9000,revision:2};const updates=[...versions,{item:newer,effectiveAt:'2026-10-11T07:00:00Z',publishedAt:'2026-10-11T07:00:00Z'}];
 const configured=addConfiguredDraftItem(current,box.id,updates,5,' Pack separately ','2026-10-11T08:00:00Z');
 assert.equal(configured.lines.length,2);assert.equal(configured.lines[0].quantity,1);assert.equal(configured.lines[0].note,'');assert.equal(configured.lines[1].note,'Pack separately');assert.equal(configured.lines[1].item.priceKhr,5050);assert.deepEqual(configured.lines[1].materials,[{itemId:raw.id,quantity:5}]);
 const merged=addConfiguredDraftItem(configured,box.id,updates,10,'Pack separately');assert.equal(merged.lines[1].quantity,15);assert.equal(configured.lines[1].quantity,5);
 assert.throws(()=>addConfiguredDraftItem(configured,box.id,updates,999,'Pack separately'),/invalid_quantity/);assert.throws(()=>addConfiguredDraftItem(current,box.id,updates,1,'x'.repeat(501)),/invalid_note/);
 assert.equal(addConfiguredDraftItem(current,box.id,updates,1,'  ').lines[0].quantity,2);
});
