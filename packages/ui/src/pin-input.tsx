import { useId, useRef } from 'react';
import { Delete, RotateCcw } from 'lucide-react';
import { useLanguage } from './shared';

/** Masked PIN entry with an app keypad. Physical typing and password-manager fill still work. */
export function PinInput({label,value,onChange,active=true,onActivate,disabled=false,autoComplete='current-password'}:{label:string;value:string;onChange:(value:string)=>void;active?:boolean;onActivate?:()=>void;disabled?:boolean;autoComplete?:'current-password'|'new-password'}){
 const {t}=useLanguage(),id=useId(),input=useRef<HTMLInputElement>(null);
 const update=(next:string)=>onChange(next.replace(/\D/g,'').slice(0,6));
 return <div className="ob-pin-entry">
  <div className="ob-pin-label"><label htmlFor={id}>{label}</label><span aria-hidden="true">{value.length} / 6</span></div>
  <div className="ob-pin-display">
   <div className="ob-pin-slots" aria-hidden="true">{Array.from({length:6},(_,index)=><span key={index} className={index<value.length?'is-filled':''}>{index<value.length?'●':''}</span>)}</div>
   <input ref={input} id={id} type="password" inputMode="none" autoComplete={autoComplete} maxLength={6} value={value} disabled={disabled} aria-controls={active?`${id}-keypad`:undefined} onFocus={onActivate} onChange={event=>update(event.target.value)}/>
  </div>
  {active&&<div className="ob-pin-keypad" id={`${id}-keypad`} role="group" aria-label={`${label} ${t('បន្ទះលេខ','keypad')}`}>
   {['1','2','3','4','5','6','7','8','9','clear','0','delete'].map(key=><button key={key} type="button" className={`d-btn d-btn-ghost ob-pin-key ${key.length>1?'ob-pin-key-action':''}`} disabled={disabled||(key.length===1?value.length===6:!value.length)} aria-label={key==='clear'?t('សម្អាត PIN','Clear PIN'):key==='delete'?t('លុបលេខចុងក្រោយ','Delete last digit'):key} onPointerDown={event=>{event.preventDefault();input.current?.focus({preventScroll:true});}} onClick={()=>update(key==='clear'?'':key==='delete'?value.slice(0,-1):value+key)}>{key==='clear'?<RotateCcw size={20}/>:key==='delete'?<Delete size={22}/>:key}</button>)}
  </div>}
 </div>;
}
