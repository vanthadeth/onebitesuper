import {Package,Plus} from 'lucide-react';
import {useLanguage} from '@onebite/ui';
import {itemDefinition,type CatalogItem,type ItemVersion} from '@onebite/core/inventory';

/** Product cards show configured contents, never assumed portions or sample recipes. */
export function MenuCatalog({items,versions,photos,disabled,onAdd}:{items:CatalogItem[];versions:ItemVersion[];photos?:Record<string,string>;disabled:boolean;onAdd:(item:CatalogItem)=>void}){
 const {t,lang}=useLanguage();
 const name=(item:CatalogItem)=>lang==='en'&&item.nameEn?item.nameEn:item.name;
 const catalog=new Map<string,CatalogItem>();
 const now=Date.now();
 for(const version of [...versions].sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||a.item.revision-b.item.revision)){
  if(Date.parse(version.effectiveAt)<=now&&Date.parse(version.publishedAt)<=now)catalog.set(version.item.id,version.item);
 }
 const groups=[...new Set(items.map(item=>item.category))];
 return <div className="pos-product-grid">{groups.map(group=><section className="pos-product-group" key={group} aria-label={group||t('មិនមានប្រភេទ','Uncategorised')}>
  <div className="pos-group-heading"><h2>{group||t('មិនមានប្រភេទ','Uncategorised')}</h2><small>{items.filter(item=>item.category===group).length} {t('មុខទំនិញ','items')}</small></div>
  <div className="pos-category-products">{items.filter(item=>item.category===group).map(item=>{
   const definition=itemDefinition(item);
   const contents=definition.lines.filter(line=>line.section!=='packaging').slice(0,3);
   return <button className="d-card pos-product" key={item.id} disabled={disabled} onClick={()=>onAdd(item)}>
    <div className="pos-product-image">{photos?.[item.photoPath||'']?<img src={photos[item.photoPath||'']} alt="" loading="lazy"/>:<Package size={40}/>}</div>
    <div className="pos-product-copy"><strong>{name(item)}</strong>{item.description&&<p className="pos-product-description">{item.description}</p>}
     {contents.length>0&&<ul className="pos-product-contents">{contents.map((line,index)=>{const component=catalog.get(line.itemId);return component?<li key={`${line.itemId}-${index}`}>{Number((line.quantity/definition.batchYield).toFixed(3))} {line.unit} · {name(component)}</li>:null;})}</ul>}
     <div className="pos-product-price"><span>{(item.priceKhr??0).toLocaleString()}៛</span><span className="pos-product-plus"><Plus size={20}/></span></div>
    </div>
   </button>;
  })}</div>
 </section>)}</div>;
}
