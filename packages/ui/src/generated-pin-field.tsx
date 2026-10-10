import { useId, useState, type ReactNode } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { useLanguage } from './shared';

/** Controlled, read-only PIN display. The caller owns generation, validation and saving. */
export function GeneratedPinField({label,value,disabled=false,onRegenerate,help}:{label:string;value:string;disabled?:boolean;onRegenerate:()=>void;help?:ReactNode}){
 const {t}=useLanguage(),id=useId();
 const [copiedValue,setCopiedValue]=useState<string>(),[failedValue,setFailedValue]=useState<string>();
 const copied=copiedValue===value,failed=failedValue===value;
 async function copy(){const selected=value;setFailedValue(undefined);try{await navigator.clipboard.writeText(selected);setCopiedValue(selected);}catch{setCopiedValue(undefined);setFailedValue(selected);}}
 return <div className="ob-generated-pin access-generated-pin"><label htmlFor={id}>{label}</label><div className="ob-pin-value access-pin-value"><input className="d-input" id={id} type="text" inputMode="numeric" autoComplete="off" readOnly value={value} onFocus={event=>event.target.select()}/><button type="button" className="d-btn d-btn-ghost d-btn-square access-icon" aria-label={t('បង្កើត PIN ថ្មី','Regenerate PIN')} title={t('បង្កើត PIN ថ្មី','Regenerate PIN')} disabled={disabled} onClick={()=>{setCopiedValue(undefined);setFailedValue(undefined);onRegenerate();}}><RefreshCw size={18}/></button><button type="button" className="d-btn d-btn-ghost d-btn-square access-icon" aria-label={t('ចម្លង PIN','Copy PIN')} title={t('ចម្លង PIN','Copy PIN')} disabled={disabled} onClick={()=>void copy()}>{copied?<Check size={18}/>:<Copy size={18}/>}</button></div>{copied&&<small role="status">{t('បានចម្លង PIN','PIN copied')}</small>}{failed&&<small role="alert">{t('មិនអាចចម្លងបាន។ សូមជ្រើស PIN និងចម្លងដោយដៃ។','Could not copy. Select the PIN and copy it manually.')}</small>}{help&&<small>{help}</small>}</div>;
}
