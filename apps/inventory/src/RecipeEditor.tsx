import {Plus,Trash2,Layers3} from 'lucide-react';
import {SelectField,useLanguage} from '@onebite/ui';
import {recipeMaterials,type CatalogItem,type RecipeLine} from '@onebite/core/inventory';
export function RecipeEditor({item,catalog,disabled,onChange}:{item:CatalogItem;catalog:CatalogItem[];disabled:boolean;onChange:(recipe:RecipeLine[])=>void}){
 const {t,lang}=useLanguage(),lines=item.recipe??[];
 const name=(value:CatalogItem)=>lang==='en'&&value.nameEn?value.nameEn:value.name;
 const available=catalog.filter(value=>value.id!==item.id&&value.active&&(value.kind==='material'||item.kind==='sellable'&&value.kind==='finished'&&Boolean(value.recipe?.length))).sort((a,b)=>name(a).localeCompare(name(b)));
 const next=available.find(value=>!lines.some(line=>line.itemId===value.id));
 function update(index:number,value:Partial<RecipeLine>){onChange(lines.map((line,i)=>i===index?{...line,...value}:line));}
 return <section className="inventory-recipe"><div className="inventory-recipe-heading"><Layers3 size={20}/><div><h3>{item.kind==='finished'?t('គ្រឿងផ្សំ និងសម្ភារៈ','Ingredients & materials'):t('រូបមន្តមុខទំនិញ','Item recipe')}</h3><p>{t(`បរិមាណសម្រាប់ 1 ${item.unit}។`,`Quantities for 1 ${item.unit}.`)}</p></div></div>
 {lines.map((line,index)=>{const current=catalog.find(value=>value.id===line.itemId);return <div className="inventory-recipe-line" key={index}>
 <label>{t('សមាសធាតុ','Component')} {index+1}<SelectField presentation="dropdown" aria-label={`${t('សមាសធាតុ','Component')} ${index+1}`} value={line.itemId} disabled={disabled} onChange={event=>update(index,{itemId:event.target.value,quantity:1})}>
 {!available.some(value=>value.id===line.itemId)&&<option value={line.itemId}>{current?name(current):t('សូមជ្រើសរើស','Select a component')}</option>}
 {available.filter(value=>value.id===line.itemId||!lines.some(other=>other.itemId===value.id)).map(value=><option key={value.id} value={value.id}>{name(value)} · {value.unit}{value.kind==='finished'?t(' · ផលិតផលសម្រេច',' · Finished product'):''}</option>)}
 </SelectField></label>
 <label>{t('បរិមាណ','Quantity')} ({current?.unit||'—'})<input aria-label={`${t('បរិមាណ','Quantity')} ${index+1}`} className="d-input" type="number" inputMode="decimal" min={current?.unit==='pcs'?1:0.001} max={1e9} step={current?.unit==='pcs'?1:.001} value={line.quantity||''} disabled={disabled} required onChange={event=>update(index,{quantity:Number(event.target.value)})}/></label>
 <button className="d-btn d-btn-ghost" type="button" aria-label={`${t('លុបសមាសធាតុ','Remove component')} ${index+1}`} disabled={disabled} onClick={()=>onChange(lines.filter((_,i)=>i!==index))}><Trash2 size={18}/></button>
 </div>;})}
 {!lines.length&&<p>{item.kind==='finished'?t('បន្ថែមសម្ភារៈយ៉ាងហោចណាស់មួយ។','Add at least one ingredient or material.'):t('បន្ថែមផលិតផលសម្រេច គ្រឿងផ្សំ ឬសម្ភារៈវេចខ្ចប់។','Add finished products, ingredients or packaging.')}</p>}
 <button type="button" className="d-btn d-btn-outline" disabled={disabled||!next||lines.length>=100} onClick={()=>{if(next)onChange([...lines,{itemId:next.id,quantity:1}]);}}><Plus size={18}/>{item.kind==='finished'?t('បន្ថែមគ្រឿងផ្សំ','Add ingredient'):t('បន្ថែមសមាសធាតុ','Add component')}</button>
 {!available.length&&<p className="inventory-recipe-hint">{t('បង្កើតសម្ភារៈដំបូងនៅទំព័រសម្ភារៈ។','Create raw materials on the Materials page first.')}</p>}
 <RecipeSummary item={item} catalog={catalog}/>
 </section>;
}
export function RecipeSummary({item,catalog}:{item:CatalogItem;catalog:CatalogItem[]}){
 const {t,lang}=useLanguage();let materials:RecipeLine[]=[];
 try{materials=recipeMaterials(item,catalog);}catch{return <p className="inventory-recipe-hint">{t('រូបមន្តមិនទាន់ពេញលេញ ឬមានសមាសធាតុមិនដំណើរការ។','Recipe is incomplete or contains unavailable components.')}</p>;}
 if(!materials.length)return null;
 const name=(value:CatalogItem)=>lang==='en'&&value.nameEn?value.nameEn:value.name;
 return <div className="inventory-recipe-summary"><h3>{t('សម្ភារៈសរុប','Raw-material breakdown')}</h3><p>{t(`សម្រាប់ 1 ${item.unit}។`,`For 1 ${item.unit}.`)}</p><dl>{materials.map(line=>{const component=catalog.find(value=>value.id===line.itemId)!;return <div key={line.itemId}><dt>{name(component)}</dt><dd>{line.quantity.toLocaleString(undefined,{maximumFractionDigits:6})} {component.unit}</dd></div>;})}</dl></div>;
}
