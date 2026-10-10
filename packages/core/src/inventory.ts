export type CatalogKind = 'material' | 'sellable';
export type MaterialUnit = 'pcs' | 'g' | 'ml';
export type CatalogItem = {
 id:string; kind:CatalogKind; name:string; nameEn:string; category:string;
 unit:string; priceKhr:number|null; packName:string; packQuantity:number|null;
 description:string; active:boolean; photoPath:string|null; revision:number;
};
export type CatalogOperation = {id:string; item:CatalogItem; image?:string|null; createdAt:number; error?:string};
export function newCatalogItem(kind:CatalogKind):CatalogItem {
 return {id:crypto.randomUUID(),kind,name:'',nameEn:'',category:kind==='material'?'ingredient':'',unit:kind==='material'?'pcs':'box',priceKhr:kind==='sellable'?0:null,packName:'',packQuantity:null,description:'',active:true,photoPath:null,revision:0};
}
export function validateCatalogItem(item:CatalogItem):CatalogItem {
 const value={...item,name:item.name.trim(),nameEn:item.nameEn.trim(),category:item.category.trim(),unit:item.unit.trim(),packName:item.packName.trim(),description:item.description.trim()};
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.id)||!['material','sellable'].includes(value.kind)||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.active!=='boolean')throw new Error('invalid_item');
 if(!value.name||value.name.length>100||value.nameEn.length>100||value.description.length>2000||!value.category||value.category.length>60||!value.unit||value.unit.length>30)throw new Error('invalid_item');
 if(value.kind==='material'){
  if(!['ingredient','packaging'].includes(value.category)||!['pcs','g','ml'].includes(value.unit)||value.priceKhr!==null)throw new Error('invalid_item');
  if(value.packName.length>60||Boolean(value.packName)!==(value.packQuantity!==null)||value.packQuantity!==null&&(!Number.isFinite(value.packQuantity)||value.packQuantity<=0||value.packQuantity>1e9||Math.round(value.packQuantity*1000)!==value.packQuantity*1000||value.unit==='pcs'&&!Number.isInteger(value.packQuantity)))throw new Error('invalid_pack');
 }else if(!Number.isSafeInteger(value.priceKhr)||value.priceKhr!<0||value.priceKhr!>1e9||value.packName||value.packQuantity!==null)throw new Error('invalid_price');
 if(value.photoPath!==null&&!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(value.photoPath))throw new Error('invalid_photo');
 return value;
}
/** Keep pending local values visible without pretending they are published. */
export function projectCatalog(items:CatalogItem[],operations:CatalogOperation[]):CatalogItem[]{
 const result=new Map(items.map(item=>[item.id,item]));
 for(const operation of operations)result.set(operation.item.id,operation.item);
 return [...result.values()];
}
