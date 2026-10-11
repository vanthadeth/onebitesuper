import {MenuProduct} from './MenuProduct';
import {useLanguage} from '@onebite/ui';
import {type CatalogItem} from '@onebite/core/inventory';

/** Compact ordering cards: square photo, name, price and add affordance. */
export function MenuCatalog({items,photos,disabled,onAdd,onSettings}:{items:CatalogItem[];photos?:Record<string,string>;disabled:boolean;onAdd:(item:CatalogItem)=>void;onSettings:(item:CatalogItem)=>void}){
 const {t}=useLanguage();
 const groups=[...new Set(items.map(item=>item.category))];
 return <div className="pos-product-grid">{groups.map(group=><section className="pos-product-group" key={group} aria-label={group||t('មិនមានប្រភេទ','Uncategorised')}>
  <div className="pos-group-heading"><h2>{group||t('មិនមានប្រភេទ','Uncategorised')}</h2><small>{items.filter(item=>item.category===group).length} {t('មុខទំនិញ','items')}</small></div>
  <div className="pos-category-products">{items.filter(item=>item.category===group).map(item=><MenuProduct key={item.id} item={item} photo={photos?.[item.photoPath||'']} disabled={disabled} onAdd={()=>onAdd(item)} onSettings={()=>onSettings(item)}/>) }</div>
 </section>)}</div>;
}
