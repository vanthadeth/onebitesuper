import {itemDefinition,snapshotItemForOrder,type CatalogItem,type ItemVersion} from './inventory.ts';
import {roundInvoice} from './domain.ts';

export type DraftLine={id:string;item:CatalogItem;quantity:number;note:string;materials:{itemId:string;quantity:number}[]};
export type PosDraft={id:string;siteId:number;startedAt:string|null;versions:ItemVersion[];lines:DraftLine[];label:string;note:string};
export type CancelledDraft={draft:PosDraft;reason:string;at:string};
export type PosWorkspace={schema:1;revision?:number;current:PosDraft;held:PosDraft[];cancelled:CancelledDraft[]};
export function emptyDraft(siteId:number):PosDraft{return {id:crypto.randomUUID(),siteId,startedAt:null,versions:[],lines:[],label:'',note:''};}
export function emptyWorkspace(siteId:number):PosWorkspace{return {schema:1,current:emptyDraft(siteId),held:[],cancelled:[]};}
export function effectiveMenu(versions:ItemVersion[],at=new Date().toISOString()):CatalogItem[]{
 const time=Date.parse(at),selected=new Map<string,ItemVersion>();
 for(const v of versions){if(Date.parse(v.effectiveAt)>time||Date.parse(v.publishedAt)>time)continue;const old=selected.get(v.item.id);if(!old||Date.parse(v.effectiveAt)>Date.parse(old.effectiveAt)||Date.parse(v.effectiveAt)===Date.parse(old.effectiveAt)&&v.item.revision>old.item.revision)selected.set(v.item.id,v);}
 return [...selected.values()].map(v=>v.item).filter(i=>i.active&&itemDefinition(i).canSell).sort((a,b)=>a.name.localeCompare(b.name));
}
export function addDraftItem(draft:PosDraft,itemId:string,versions:ItemVersion[],quantity=1,at=new Date().toISOString()):PosDraft{
 if(!Number.isInteger(quantity)||quantity<1||quantity>999)throw new Error('invalid_quantity');
 const startedAt=draft.startedAt??at,locked=draft.startedAt?draft.versions:versions;
 const snapshot=snapshotItemForOrder(itemId,startedAt,locked);
 if(!Number.isSafeInteger(snapshot.item.priceKhr)||snapshot.item.priceKhr!<0)throw new Error('invalid_price');
 const existing=draft.lines.find(line=>line.item.id===itemId&&!line.note);
 if(existing&&existing.quantity+quantity>999)throw new Error('invalid_quantity');
 return {...draft,startedAt,versions:draft.startedAt?draft.versions:snapshot.versions,lines:existing?draft.lines.map(line=>line===existing?{...line,quantity:line.quantity+quantity}:line):[...draft.lines,{id:crypto.randomUUID(),item:snapshot.item,quantity,note:'',materials:snapshot.materials}]};
}
export function addConfiguredDraftItem(draft:PosDraft,itemId:string,versions:ItemVersion[],quantity:number,note:string,at=new Date().toISOString()):PosDraft{
 note=note.trim();if(note.length>500)throw new Error('invalid_note');
 if(!note)return addDraftItem(draft,itemId,versions,quantity,at);
 const added=addDraftItem({...draft,lines:[]},itemId,versions,quantity,at);
 const existing=draft.lines.find(line=>line.item.id===itemId&&line.note===note);
 if(existing&&existing.quantity+quantity>999)throw new Error('invalid_quantity');
 return {...added,lines:existing?draft.lines.map(line=>line===existing?{...line,quantity:line.quantity+quantity}:line):[...draft.lines,{...added.lines[0],note}]};
}
export function draftAmounts(draft:PosDraft){const subtotal=draft.lines.reduce((sum,line)=>sum+(line.item.priceKhr??0)*line.quantity,0),total=roundInvoice(subtotal);return {subtotal,total,rounding:total-subtotal};}
export function holdDraft(workspace:PosWorkspace):PosWorkspace{
 if(!workspace.current.lines.length)return workspace;
 if(workspace.held.length>=100)throw new Error('held_limit');
 return {...workspace,current:emptyDraft(workspace.current.siteId),held:[...workspace.held,workspace.current]};
}
export function resumeDraft(workspace:PosWorkspace,id:string):PosWorkspace{
 const target=workspace.held.find(d=>d.id===id);if(!target)throw new Error('not_found');
 return {...workspace,current:target,held:[...workspace.held.filter(d=>d.id!==id),...(workspace.current.lines.length?[workspace.current]:[])]};
}
export function cancelDraft(workspace:PosWorkspace,id:string,reason:string,at=new Date().toISOString()):PosWorkspace{
 reason=reason.trim();if(!reason||reason.length>500)throw new Error('reason_required');
 const draft=workspace.current.id===id?workspace.current:workspace.held.find(d=>d.id===id);
 if(!draft?.lines.length)throw new Error('not_found');
 return {...workspace,current:workspace.current.id===id?emptyDraft(draft.siteId):workspace.current,held:workspace.held.filter(d=>d.id!==id),cancelled:[...workspace.cancelled,{draft,reason,at}]};
}
export function cashEquivalent(khr:number,usd:number,rate:number){if([khr,usd].some(v=>!Number.isFinite(v)||v<0)||!Number.isFinite(rate)||rate<=0)throw new Error('invalid_amount');return Math.round((khr+usd*rate)*100)/100;}
