import {Package,Plus} from 'lucide-react';
import {useLanguage} from '@onebite/ui';
import {type CatalogItem} from '@onebite/core/inventory';

/** Compact ordering cards: square photo, name, price and add affordance. */
export function MenuCatalog({items,photos,disabled,onAdd}:{items:CatalogItem[];photos?:Record<string,string>;disabled:boolean;onAdd:(item:CatalogItem)=>void}){
 const {t,lang}=useLanguage();
 const name=(item:CatalogItem)=>lang==='en'&&item.nameEn?item.nameEn:item.name;
 const groups=[...new Set(items.map(item=>item.category))];
 return <div className="pos-product-grid">{groups.map(group=><section className="pos-product-group" key={group} aria-label={group||t('មិនមានប្រភេទ','Uncategorised')}>
  <div className="pos-group-heading"><h2>{group||t('មិនមានប្រភេទ','Uncategorised')}</h2><small>{items.filter(item=>item.category===group).length} {t('មុខទំនិញ','items')}</small></div>
  <div className="pos-category-products">{items.filter(item=>item.category===group).map(item=>{
   return <button className="d-card pos-product" key={item.id} disabled={disabled} onClick={()=>onAdd(item)}>
    <div className="pos-product-image">{photos?.[item.photoPath||'']?<img src={photos[item.photoPath||'']} alt="" loading="lazy"/>:<Package size={40}/>}</div>
    <div className="pos-product-copy"><strong>{name(item)}</strong>
     <div className="pos-product-price"><span>{(item.priceKhr??0).toLocaleString()}៛</span><span className="pos-product-plus"><Plus size={20}/></span></div>
    </div>
   </button>;
  })}</div>
 </section>)}</div>;
}
