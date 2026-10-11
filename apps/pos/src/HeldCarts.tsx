import {ArrowLeft,Pause,Trash2} from 'lucide-react';
import {EmptyState,useLanguage} from '@onebite/ui';
import {draftAmounts,type PosDraft,type CancelledDraft} from '@onebite/core/pos';
export function HeldCarts({held,cancelled,busy,canEdit,canCancel,onBack,onOpen,onCancel}:{held:PosDraft[];cancelled:CancelledDraft[];busy:boolean;canEdit:boolean;canCancel:boolean;onBack:()=>void;onOpen:(id:string)=>void;onCancel:(id:string)=>void}){
 const {t,lang}=useLanguage();
 const time=(value:string)=>new Intl.DateTimeFormat(lang==='km'?'km-KH':'en',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Phnom_Penh'}).format(new Date(value));
 return <section className="d-card pos-cart pos-held-panel" aria-label={t('កន្ត្រកដែលបានទុក','Held carts')}>
  <div className="pos-cart-heading"><h2>{t('កន្ត្រកដែលបានទុក','Held carts')} <span className="d-badge d-badge-soft">{held.length}</span></h2><button className="d-btn d-btn-ghost d-btn-square" aria-label={t('ត្រឡប់ទៅកន្ត្រក','Back to cart')} onClick={onBack} disabled={busy}><ArrowLeft size={20}/></button></div>
  <div className="pos-cart-body"><div className="pos-held-list">{held.length?held.map(draft=><article className="pos-held-card" key={draft.id}>
   <div className="pos-held-summary"><strong>{draft.label||'#'+draft.id.slice(0,6).toUpperCase()}</strong><strong>{draftAmounts(draft).total.toLocaleString()}៛</strong></div>
   <p>{draft.lines.map(line=>`${line.quantity} × ${lang==='en'&&line.item.nameEn?line.item.nameEn:line.item.name}`).join(', ')}</p>
   {draft.startedAt&&<small>{time(draft.startedAt)}</small>}
   <div><button className="d-btn d-btn-primary" disabled={busy||!canEdit} onClick={()=>onOpen(draft.id)}>{t('បើកកន្ត្រក','Open cart')}</button>{canCancel&&<button className="d-btn d-btn-ghost d-btn-square" aria-label={`${t('បោះបង់កន្ត្រក','Cancel cart')} ${draft.id.slice(0,6)}`} disabled={busy} onClick={()=>onCancel(draft.id)}><Trash2 size={17}/></button>}</div>
  </article>):<EmptyState icon={<Pause size={28}/>} title={t('គ្មានកន្ត្រកដែលបានទុក','No held carts')} body={t('កន្ត្រកដែលបានទុកនឹងបង្ហាញនៅទីនេះ។','Held carts will appear here.')} action={{label:t('ត្រឡប់ទៅកន្ត្រក','Back to cart'),onClick:onBack}}/>}</div>
  {cancelled.length>0&&<section className="pos-cancel-history"><h3>{t('កន្ត្រកដែលបានបោះបង់','Cancelled drafts')}</h3>{cancelled.slice(-20).reverse().map(record=><div key={record.draft.id}><strong>#{record.draft.id.slice(0,6).toUpperCase()}</strong><p>{record.reason}</p><small>{time(record.at)}</small></div>)}</section>}
  </div>
 </section>;
}
