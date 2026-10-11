import {useState,useId} from 'react';
import {Package,Minus,Plus,MessageSquareText,ShoppingBag} from 'lucide-react';
import {AppDialog,useLanguage} from '@onebite/ui';
import type {CatalogItem} from '@onebite/core/inventory';

function ItemNumberInputGroup({label,value,unit,disabled,onChange}:{label:string;value:number;unit?:string;disabled:boolean;onChange?:(value:number)=>void}){
 const id=useId(),{t}=useLanguage();
 return <div className="pos-item-number-field"><label htmlFor={id}>{label}</label><div className="pos-item-stepper" role="group" aria-label={label+' · − / +'}><button type="button" className="d-btn d-btn-ghost d-btn-square" aria-label={t('បន្ថយ','Decrease')+' '+label.toLocaleLowerCase()} disabled={disabled||value<=1} onClick={()=>onChange?.(Math.max(1,value-1))}><Minus size={17}/></button><input id={id} className="d-input" type="number" min={1} max={999} step={1} value={value} disabled={disabled} onChange={event=>onChange?.(Number(event.target.value))}/><button type="button" className="d-btn d-btn-ghost d-btn-square" aria-label={t('បន្ថែម','Increase')+' '+label.toLocaleLowerCase()} disabled={disabled||value>=999} onClick={()=>onChange?.(Math.min(999,value+1))}><Plus size={17}/></button></div>{unit&&<small>{unit}</small>}</div>;
}

export function ItemSettings({item,photo,rate,quantity:initialQuantity=1,note:initialNote='',editing=false,busy,canEdit,onClose,onSave}:{item:CatalogItem;photo?:string;rate:number;quantity?:number;note?:string;editing?:boolean;busy:boolean;canEdit:boolean;onClose:()=>void;onSave:(quantity:number,note:string)=>Promise<void>}){
 const {t,lang}=useLanguage();
 const [quantity,setQuantity]=useState(initialQuantity),[note,setNote]=useState(initialNote),[remarks,setRemarks]=useState(Boolean(initialNote)),[kind,setKind]=useState<'percent'|'fixed'>('percent'),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const name=lang==='en'&&item.nameEn?item.nameEn:item.name,disabled=busy||saving||!canEdit,valid=Number.isInteger(quantity)&&quantity>=1&&quantity<=999,gross=valid?(item.priceKhr??0)*quantity:0;
 async function save(){if(disabled||!valid)return;setSaving(true);setError('');try{await onSave(quantity,note.trim());onClose();}catch{setError(t('មិនអាចរក្សាទុក។ សូមព្យាយាមម្ដងទៀត។','Could not save. Please try again.'));}finally{setSaving(false);}}
 return <AppDialog title={`${t('ការកំណត់មុខទំនិញ','Item settings')} · ${name}`} onClose={()=>{if(!busy&&!saving)onClose();}} footer={<div className="pos-item-settings-actions"><button className="d-btn d-btn-outline" aria-pressed={remarks} disabled={disabled} onClick={()=>setRemarks(value=>!value)}><MessageSquareText size={18}/>{t('កំណត់សម្គាល់','Remarks')}</button><button className="d-btn d-btn-primary" disabled={disabled||!valid} onClick={()=>void save()}><ShoppingBag size={18}/>{editing?t('កែប្រែកន្ត្រក','Update cart'):t('បន្ថែមក្នុងកន្ត្រក','Add to cart')}</button></div>}>
  <div className="pos-item-settings">
   <div className="pos-item-settings-intro"><div className="pos-item-settings-photo">{photo?<img src={photo} alt=""/>:<Package size={34}/>}</div><div><h2>{name}</h2>{item.description&&<p>{item.description}</p>}<small>{(item.priceKhr??0).toLocaleString()}៛ / {item.unit}</small></div></div>
   <div className="pos-item-setting-row"><div className="d-join pos-item-button-group pos-item-presets" role="group" aria-label={t('ចំនួនរហ័ស','Quantity presets')}>{[1,5,10].map(value=><button key={value} className="d-btn d-btn-outline d-join-item" aria-pressed={quantity===value} disabled={disabled} onClick={()=>setQuantity(value)}>{value}</button>)}</div><ItemNumberInputGroup label={t('ចំនួន','Quantity')} value={quantity} disabled={disabled} onChange={setQuantity}/></div>
   <div className="pos-item-setting-row"><div className="d-join pos-item-button-group pos-item-discount-kind" role="group" aria-label={t('ប្រភេទបញ្ចុះតម្លៃ','Discount type')}><button className="d-btn d-btn-outline d-join-item" aria-pressed={kind==='percent'} disabled={disabled} onClick={()=>setKind('percent')}>%</button><button className="d-btn d-btn-outline d-join-item" aria-pressed={kind==='fixed'} disabled={disabled} onClick={()=>setKind('fixed')}>{t('ចំនួនថេរ','Fixed amount')}</button></div><ItemNumberInputGroup label={t('បញ្ចុះតម្លៃ','Discount')} value={0} unit={kind==='percent'?'%':'KHR / '+item.unit} disabled/></div>
   <p className="pos-item-discount-notice">{t('ការបញ្ចុះតម្លៃមិនទាន់អាចប្រើបាន រហូតដល់ម្ចាស់កំណត់កម្រិត។','Discounts are unavailable until Owner limits are set.')}</p>
   <section className="pos-item-calculation" aria-label={t('សង្ខេបការគណនា','Calculation summary')}><h3>{t('សង្ខេបការគណនា','Calculation summary')}</h3><dl><div><dt>{valid?quantity:'—'} × {(item.priceKhr??0).toLocaleString()}៛</dt><dd>{gross.toLocaleString()}៛</dd></div><div><dt>{t('បញ្ចុះតម្លៃ','Discount')}</dt><dd>0៛</dd></div><div className="pos-item-net"><dt>{t('សរុបមុខទំនិញ','Item total')}</dt><dd>{gross.toLocaleString()}៛<small>≈ ${(gross/rate).toFixed(2)}</small></dd></div></dl></section>
   {remarks&&<label className="pos-note-label">{t('កំណត់សម្គាល់មុខទំនិញ','Item remarks')}<textarea className="d-textarea" autoFocus maxLength={500} value={note} disabled={disabled} onChange={event=>setNote(event.target.value)}/></label>}
   {error&&<p className="pos-item-error" role="alert">{error}</p>}
  </div>
 </AppDialog>;
}
