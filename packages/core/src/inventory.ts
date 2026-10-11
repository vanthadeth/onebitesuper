export type CatalogKind = 'material' | 'finished' | 'sellable';
export type RecipeLine = {itemId:string;quantity:number};
export type MaterialUnit = string;
export type CatalogItem = {
 id:string; kind:CatalogKind; name:string; nameEn:string; category:string;
 unit:string; priceKhr:number|null; packName:string; packQuantity:number|null;
 description:string; active:boolean; photoPath:string|null; revision:number; recipe?:RecipeLine[]; definition?:ItemDefinition;
};
export type CatalogOperation = {id:string; item:CatalogItem; image?:string|null; confirmedActive?:boolean; createdAt:number; error?:string};
export function newCatalogItem(kind:CatalogKind):CatalogItem {
 return {id:crypto.randomUUID(),kind,name:'',nameEn:'',category:kind==='material'?'ingredient':'',unit:kind==='sellable'?'box':'pcs',priceKhr:kind==='sellable'?0:null,packName:'',packQuantity:null,description:'',active:true,photoPath:null,revision:0,...(kind!=='material'?{recipe:[]}:{})};
}
export function validateCatalogItem(item:CatalogItem):CatalogItem {
 const value={...item,name:item.name.trim(),nameEn:item.nameEn.trim(),category:item.category.trim(),unit:item.unit.trim(),packName:item.packName.trim(),description:item.description.trim()};
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.id)||!['material','finished','sellable'].includes(value.kind)||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.active!=='boolean')throw new Error('invalid_item');
 if(value.definition)return validateUnifiedItem(value);
 if(!value.name||value.name.length>100||value.nameEn.length>100||value.description.length>2000||!value.category||value.category.length>60||!value.unit||value.unit.length>30)throw new Error('invalid_item');
 if(value.kind==='material'){
  if(value.priceKhr!==null)throw new Error('invalid_item');
  if(value.packName.length>60||Boolean(value.packName)!==(value.packQuantity!==null)||value.packQuantity!==null&&(!Number.isFinite(value.packQuantity)||value.packQuantity<=0||value.packQuantity>1e9||Math.round(value.packQuantity*1000)!==value.packQuantity*1000||value.unit==='pcs'&&!Number.isInteger(value.packQuantity)))throw new Error('invalid_pack');
 }else if(value.packName||value.packQuantity!==null||value.kind==='finished'&&value.priceKhr!==null||value.kind==='sellable'&&(!Number.isSafeInteger(value.priceKhr)||value.priceKhr!<0||value.priceKhr!>1e9))throw new Error('invalid_price');
 validateRecipeShape(value);
 if(value.photoPath!==null&&!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(value.photoPath))throw new Error('invalid_photo');
 return value;
}
export function validateRecipeShape(item:CatalogItem){
 const lines=item.recipe??[];
 if(!Array.isArray(lines)||lines.length>100||item.kind==='material'&&lines.length||item.kind==='finished'&&!lines.length)throw new Error('invalid_recipe');
 const seen=new Set<string>();
 for(const line of lines){
  if(!line||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(line.itemId)||line.itemId===item.id||seen.has(line.itemId)||!Number.isFinite(line.quantity)||line.quantity<=0||line.quantity>1e9||Math.abs(line.quantity*1000-Math.round(line.quantity*1000))>1e-6)throw new Error('invalid_recipe');
  seen.add(line.itemId);
 }
}
/** Two levels only: raw materials → finished products → sellable items. */
export function validateRecipe(item:CatalogItem,catalog:CatalogItem[]){
 if(item.definition){validateUnifiedRecipe(item,catalog);return item;}
 validateRecipeShape(item);
 for(const line of item.recipe??[]){
  const component=catalog.find(value=>value.id===line.itemId);
  if(!component||!component.active||component.kind==='sellable'||item.kind==='finished'&&component.kind!=='material'||component.unit==='pcs'&&!Number.isInteger(line.quantity))throw new Error('invalid_recipe');
  if(component.kind==='finished')validateRecipe(component,catalog);
 }
 return item;
}
/** Preview the base materials needed for one unit; this does not post stock movements. */
export function recipeMaterials(item:CatalogItem,catalog:CatalogItem[]):RecipeLine[]{
 if(item.definition)return unifiedMaterials(item,catalog);
 const totals=new Map<string,number>();
 validateRecipe(item,catalog);
 for(const line of item.recipe??[]){
  const component=catalog.find(value=>value.id===line.itemId)!;
  if(component.kind==='material')totals.set(component.id,(totals.get(component.id)??0)+line.quantity);
  else {validateRecipe(component,catalog);for(const raw of component.recipe??[])totals.set(raw.itemId,(totals.get(raw.itemId)??0)+line.quantity*raw.quantity);}
 }
 return [...totals].map(([itemId,quantity])=>({itemId,quantity:Math.round(quantity*1e6)/1e6}));
}
/** Keep pending local values visible without pretending they are published. */
export function projectCatalog(items:CatalogItem[],operations:CatalogOperation[]):CatalogItem[]{
 const result=new Map(items.map(item=>[item.id,item]));
 for(const operation of operations)result.set(operation.item.id,operation.item);
 return [...result.values()];
}

export type ReferenceKind='material_category'|'sellable_category'|'unit';
export type CatalogReference={id:string;kind:ReferenceKind;value:string;name:string;active:boolean;revision:number};
export type ReferenceOperation={id:string;reference:CatalogReference;confirmedActive?:boolean;createdAt:number;error?:string};
export function newCatalogReference(kind:ReferenceKind):CatalogReference{return {id:crypto.randomUUID(),kind,value:'',name:'',active:true,revision:0};}
export function validateCatalogReference(reference:CatalogReference):CatalogReference{
 const value={...reference,name:reference.name.trim(),value:reference.value.trim()};
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.id)||!['material_category','sellable_category','unit'].includes(value.kind)||!value.name||value.name.length>60||!value.value||value.value.length>(value.kind==='unit'?30:60)||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.active!=='boolean')throw new Error('invalid_reference');
 if(value.revision===0&&!value.active||['__create__','__manage__','all'].includes(value.value))throw new Error('invalid_reference');
 return value;
}
export function projectReferences(references:CatalogReference[],operations:ReferenceOperation[]):CatalogReference[]{
 const result=new Map(references.map(reference=>[reference.id,reference]));for(const operation of operations)result.set(operation.reference.id,operation.reference);return [...result.values()];
}


/** Item identity is independent of sale eligibility. Legacy kind remains a transport compatibility field. */
export type ItemType='finished_good'|'raw_material'|'supplies'|'component';
export type RecipeSection='ingredients'|'contents'|'packaging';
export type UnifiedRecipeLine={itemId:string;quantity:number;unit:string;section:RecipeSection};
export type ItemConversion={unit:string;factor:number}; // one entered unit equals factor base units
export type ItemDefinition={schema:1;type:ItemType;canSell:boolean;batchYield:number;effectiveAt:string;lines:UnifiedRecipeLine[];conversions:ItemConversion[]};
export type ItemVersion={item:CatalogItem;publishedAt:string;effectiveAt:string};
export const itemTypes:ItemType[]=['finished_good','raw_material','supplies','component'];
export const recipeSections:RecipeSection[]=['ingredients','contents','packaging'];
export function itemDefinition(item:CatalogItem):ItemDefinition{
 if(item.definition)return item.definition;
 return {schema:1,type:item.kind==='finished'?'component':item.kind==='sellable'?'finished_good':'raw_material',canSell:item.kind==='sellable',batchYield:1,effectiveAt:new Date(0).toISOString(),lines:(item.recipe??[]).map(line=>({...line,unit:'',section:'ingredients'})),conversions:[]};
}
export function newUnifiedItem():CatalogItem{
 const item=newCatalogItem('material');
 return {...item,category:'',definition:{schema:1,type:'raw_material',canSell:false,batchYield:1,effectiveAt:new Date().toISOString(),lines:[],conversions:[]}};
}
export function editUnifiedItem(item:CatalogItem,catalog:CatalogItem[]):CatalogItem{
 const definition=itemDefinition(item);
 return {...item,definition:{...definition,effectiveAt:new Date().toISOString(),lines:definition.lines.map(line=>({...line,unit:line.unit||catalog.find(value=>value.id===line.itemId)?.unit||'pcs'}))}};
}
const positive=(n:number)=>Number.isFinite(n)&&n>0&&n<=1e9&&Math.abs(n*1e6-Math.round(n*1e6))<1e-5;
export function validateUnifiedItem(item:CatalogItem):CatalogItem{
 const d=item.definition!;
 if(!item.name||item.name.length>100||item.nameEn.length>100||item.description.length>2000||item.category.length>60||!item.unit||item.unit.length>30||d.schema!==1||!itemTypes.includes(d.type)||typeof d.canSell!=='boolean'||!positive(d.batchYield)||!Number.isFinite(Date.parse(d.effectiveAt))||!Array.isArray(d.lines)||d.lines.length>100||!Array.isArray(d.conversions)||d.conversions.length>30)throw new Error('invalid_item');
 if(d.canSell?(!item.category||!Number.isSafeInteger(item.priceKhr)||item.priceKhr!<0||item.priceKhr!>1e9):item.priceKhr!==null)throw new Error('invalid_price');
 if(item.packName.length>60||Boolean(item.packName)!==(item.packQuantity!==null)||item.packQuantity!==null&&(!positive(item.packQuantity)||item.unit==='pcs'&&!Number.isInteger(item.packQuantity)))throw new Error('invalid_pack');
 if(item.photoPath!==null&&!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(item.photoPath))throw new Error('invalid_photo');
 const seen=new Set<string>();
 for(const c of d.conversions){if(!c.unit||c.unit.length>30||c.unit===item.unit||seen.has(c.unit)||!positive(c.factor))throw new Error('invalid_conversion');seen.add(c.unit);}
 const lines=new Set<string>();
 for(const line of d.lines){const key=line.section+':'+line.itemId;if(!recipeSections.includes(line.section)||!/^[a-f0-9-]{36}$/.test(line.itemId)||!positive(line.quantity)||!line.unit||line.unit.length>30||lines.has(key)||line.itemId===item.id)throw new Error('invalid_recipe');lines.add(key);}
 return item;
}
export function convertItemQuantity(item:CatalogItem,quantity:number,unit:string):number{
 if(unit===item.unit)return quantity;
 // Explicit item ratios take precedence over standard same-dimension conversions.
 const custom=itemDefinition(item).conversions.find(c=>c.unit===unit);
 if(custom)return quantity*custom.factor;
 const units:Record<string,{dimension:string;factor:number}>={g:{dimension:'mass',factor:1},kg:{dimension:'mass',factor:1000},ml:{dimension:'volume',factor:1},L:{dimension:'volume',factor:1000}};
 const from=units[unit],to=units[item.unit];
 if(from&&to&&from.dimension===to.dimension)return quantity*from.factor/to.factor;
 throw new Error('invalid_conversion');
}
export function validateUnifiedRecipe(item:CatalogItem,catalog:CatalogItem[]):void{
 unifiedMaterials(item,catalog);
}
/** Traverse reusable recipes; quantities are divided by each recipe's batch output. */
export function unifiedMaterials(item:CatalogItem,catalog:CatalogItem[]):RecipeLine[]{
 const values=new Map(catalog.map(value=>[value.id,value]));values.set(item.id,item);
 const totals=new Map<string,number>();
 function expand(current:CatalogItem,quantity:number,path:Set<string>){
  if(path.has(current.id)||path.size>=20)throw new Error('invalid_recipe');
  const d=itemDefinition(current);
  if(!d.lines.length&&(d.type==='raw_material'||d.type==='supplies')){totals.set(current.id,(totals.get(current.id)??0)+quantity);return;}
  if(!d.lines.length)throw new Error('invalid_recipe');
  const next=new Set(path).add(current.id);
  for(const line of d.lines){const child=values.get(line.itemId);if(!child||!child.active)throw new Error('invalid_recipe');const amount=convertItemQuantity(child,line.quantity,line.unit||child.unit);if(child.unit==='pcs'&&!Number.isInteger(amount))throw new Error('invalid_recipe');expand(child,quantity*amount/d.batchYield,next);}
 }
 expand(item,1,new Set());
 return [...totals].map(([itemId,quantity])=>({itemId,quantity:Math.round(quantity*1e6)/1e6}));
}
/** Frozen at first item added, not at checkout. Never recalculate a held order against today's catalog. */
export function snapshotItemForOrder(itemId:string,startedAt:string,versions:ItemVersion[]){
 const time=Date.parse(startedAt);if(!Number.isFinite(time))throw new Error('invalid_order_time');
 const byId=new Map<string,ItemVersion>();
 for(const version of versions){if(Date.parse(version.effectiveAt)>time||Date.parse(version.publishedAt)>time)continue;const previous=byId.get(version.item.id);if(!previous||Date.parse(version.effectiveAt)>Date.parse(previous.effectiveAt)||Date.parse(version.effectiveAt)===Date.parse(previous.effectiveAt)&&version.item.revision>previous.item.revision)byId.set(version.item.id,version);}
 const item=byId.get(itemId)?.item;if(!item||!item.active||!itemDefinition(item).canSell)throw new Error('unavailable_item');
 const catalog=[...byId.values()].map(v=>v.item);
 return structuredClone({startedAt,item,versions:[...byId.values()],materials:unifiedMaterials(item,catalog)});
}
/** datetime-local fields represent Cambodia time, independent of the device timezone. */
export function cambodiaDateTime(iso:string){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso)).replace(' ','T');}
export function fromCambodiaDateTime(value:string){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('invalid_date');return new Date(value+':00+07:00').toISOString();}
/** Dependency-first publication for offline additions, regardless of item type. */
export function sortCatalogOperations(operations:CatalogOperation[]):CatalogOperation[]{
 const result:CatalogOperation[]=[],seen=new Set<string>(),visiting=new Set<string>(),byId=new Map(operations.map(op=>[op.item.id,op]));
 function visit(op:CatalogOperation){if(seen.has(op.id))return;if(visiting.has(op.id))throw new Error('invalid_recipe');visiting.add(op.id);for(const line of itemDefinition(op.item).lines){const dependency=byId.get(line.itemId);if(dependency)visit(dependency);}visiting.delete(op.id);seen.add(op.id);result.push(op);}
 operations.forEach(visit);return result;
}
