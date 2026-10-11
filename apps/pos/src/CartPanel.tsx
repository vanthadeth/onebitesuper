import {useState} from 'react';
import {Minus,Plus,Pause,Trash2,ShoppingBag,LockKeyhole,Package,MessageSquareText} from 'lucide-react';
import {useLanguage} from '@onebite/ui';
import {draftAmounts,type PosDraft} from '@onebite/core/pos';

type CartProps={draft:PosDraft;rate:number;busy:boolean;canEdit:boolean;canCancel:boolean;photos?:Record<string,string>;heldCount:number;onHeld:()=>void;onQuantity:(id:string,qty:number)=>void;onRemove:(id:string)=>void;onNote:(value:string)=>void;onHold:()=>void;onCancel:()=>void;onCheckout:()=>void};
export function CartPanel({draft,rate,busy,canEdit,canCancel,photos,heldCount,onHeld,onQuantity,onRemove,onNote,onHold,onCancel,onCheckout}:CartProps){
 const {t,lang}=useLanguage(),amounts=draftAmounts(draft);
 const [noteOpen,setNoteOpen]=useState(false);
 const hasItems=draft.lines.length>0;
 const count=draft.lines.reduce((sum,line)=>sum+line.quantity,0);
 return <section className="d-card pos-cart" aria-label={t('កន្ត្រកបច្ចុប្បន្ន','Current cart')}>
  <div className="pos-cart-heading"><div><strong>{t('កន្ត្រកបច្ចុប្បន្ន','Current cart')}</strong><small>{count} {t('មុខទំនិញ','items')}{hasItems?` · #${draft.id.slice(0,6).toUpperCase()}`:''}</small></div>
   <div className="pos-cart-title-actions"><button className="d-btn d-btn-ghost d-btn-circle" aria-label={t('ទុកកន្ត្រក','Hold cart')} title={t('ទុកកន្ត្រក ហើយចាប់ផ្ដើមថ្មី','Hold cart and start fresh')} disabled={busy||!canEdit||!hasItems} onClick={onHold}><Plus size={20}/></button><button className="d-btn d-btn-ghost d-btn-circle" aria-label={t('កន្ត្រកដែលបានទុក','Held carts')} title={t('កន្ត្រកដែលបានទុក','Held carts')} disabled={busy} onClick={onHeld}><Pause size={19}/>{heldCount>0&&<span className="pos-held-count">{heldCount}</span>}</button></div>
  </div>
  <div className="pos-cart-body">
   {!hasItems?<div className="pos-cart-empty"><ShoppingBag size={40}/><strong>{t('ចាប់ផ្ដើមថ្មី','A fresh start')}</strong><p>{t('ចុចមុខទំនិញ ដើម្បីបន្ថែមក្នុងកន្ត្រក។','Tap an item to add it to your cart.')}</p></div>:<ul className="pos-cart-lines">{draft.lines.map((line,index)=><li key={line.id}>
    <div className="pos-line-photo">{photos?.[line.item.photoPath||'']?<img src={photos[line.item.photoPath||'']} alt=""/>:<Package size={22}/>}</div>
    <div className="pos-line-details"><div className="pos-line-heading"><strong><span className="pos-line-number">{index+1}.</span> {lang==='en'&&line.item.nameEn?line.item.nameEn:line.item.name}</strong><strong className="pos-line-total">{((line.item.priceKhr??0)*line.quantity).toLocaleString()}៛</strong></div>
     <div className="pos-line-calculation"><output aria-label={`${t('ចំនួន','Quantity')} ${line.item.name}`}>{line.quantity}</output><span>× {(line.item.priceKhr??0).toLocaleString()}៛</span></div>
     <div className="pos-line-actions"><button className="d-btn d-btn-ghost pos-line-remove" aria-label={`${t('លុប','Remove')} ${line.item.name}`} title={t('លុប','Remove')} disabled={busy||!canEdit} onClick={()=>onRemove(line.id)}><Trash2 size={17}/></button>
      <div className="pos-quantity"><button className="d-btn d-btn-ghost" aria-label={`${t('បន្ថយ','Decrease')} ${line.item.name}`} disabled={busy||!canEdit||line.quantity===1} onClick={()=>onQuantity(line.id,line.quantity-1)}><Minus size={16}/></button><button className="d-btn d-btn-ghost" aria-label={`${t('បន្ថែម','Increase')} ${line.item.name}`} disabled={busy||!canEdit||line.quantity>=999} onClick={()=>onQuantity(line.id,line.quantity+1)}><Plus size={16}/></button></div>
     </div>
    </div>
   </li>)}</ul>}
   {(noteOpen||draft.note)&&<label className="pos-note-label">{t('កំណត់សម្គាល់','Order note')}<textarea key={draft.id+draft.note} className="d-textarea" defaultValue={draft.note} maxLength={500} disabled={busy||!canEdit} onBlur={e=>{if(e.target.value!==draft.note)onNote(e.target.value.trim());}} placeholder={t('មិនចាំបាច់','Optional')}/></label>}
  </div>
  <div className="pos-cart-footer"><dl className="pos-totals">{hasItems&&<><div><dt>{t('សរុបរង','Subtotal')}</dt><dd>{amounts.subtotal.toLocaleString()}៛</dd></div>{amounts.rounding!==0&&<div><dt>{t('បង្គត់','Rounding')}</dt><dd>{amounts.rounding>0?'+':''}{amounts.rounding}៛</dd></div>}</>}<div className="pos-total"><dt>{t('សរុប','Total')}</dt><dd>{amounts.total.toLocaleString()}៛<small>≈ ${(amounts.total/rate).toFixed(2)}</small></dd></div></dl>
   <div className="pos-cart-actions"><button className="d-btn d-btn-outline d-btn-square" aria-label={t('បោះបង់','Cancel')} title={t('បោះបង់','Cancel')} disabled={busy||!canCancel||!hasItems} onClick={onCancel}><Trash2 size={19}/></button><button className="d-btn d-btn-outline d-btn-square" aria-label={t('កំណត់សម្គាល់','Order note')} title={t('កំណត់សម្គាល់','Order note')} aria-pressed={noteOpen} disabled={busy||!canEdit} onClick={()=>setNoteOpen(value=>!value)}><MessageSquareText size={19}/></button><button className="d-btn d-btn-primary pos-payment" disabled={busy||!hasItems} onClick={onCheckout}>{t('ទទួលប្រាក់','Receive payment')}<LockKeyhole size={16}/></button></div>
   {hasItems&&<div className="pos-cart-meta"><LockKeyhole size={12}/>{t('តម្លៃ និងរូបមន្តបានរក្សាទុក។','Prices and recipes locked for this cart.')}</div>}
  </div>
 </section>;
}
