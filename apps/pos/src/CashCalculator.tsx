import {useState} from 'react';
import {Calculator} from 'lucide-react';
import {useLanguage} from '@onebite/ui';
import {cashEquivalent} from '@onebite/core/pos';
export function CashCalculator({rate}:{rate:number}){
 const {t}=useLanguage(),[khr,setKhr]=useState(''),[usd,setUsd]=useState('');
 const valid=[khr,usd].every(value=>value===''||/^\d+(\.\d{0,2})?$/.test(value)&&Number(value)<=1e9),total=valid?cashEquivalent(Number(khr),Number(usd),rate):null;
 return <section className="d-card pos-calculator"><span className="pos-feature-icon"><Calculator size={28}/></span><h2>{t('គណនាសាច់ប្រាក់','Cash calculator')}</h2><p>{t('បម្លែងប្រាក់ទាំងអស់ទៅជា KHR។ មិនកត់ត្រាការទូទាត់ទេ។','Convert the counted cash to KHR. This does not record a payment.')}</p><div className="pos-money-fields"><label>KHR<input className="d-input" inputMode="decimal" value={khr} onChange={e=>setKhr(e.target.value)} placeholder="0" maxLength={14}/></label><label>USD<input className="d-input" inputMode="decimal" value={usd} onChange={e=>setUsd(e.target.value)} placeholder="0.00" maxLength={14}/></label></div><div className="pos-equivalent"><small>{t('សរុបស្មើនឹង','Total equivalent')}</small><output aria-live="polite">{total===null?'—':total.toLocaleString()} <small>KHR</small></output></div><p>USD 1 = KHR {rate.toLocaleString()}</p></section>;
}
