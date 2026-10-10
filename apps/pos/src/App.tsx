import { Store, ArrowUpRight, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@onebite/ui';
import icon from '../../../resources/app-icons/pos.svg';
export function App(){
 const {t,lang,setLang}=useLanguage();
 return <div className="access-auth"><main className="d-card auth-card" style={{maxWidth:480,margin:'10vh auto',padding:28}}><img src={icon} width={64} alt="OneBite"/><h1>OneBite - POS</h1><div className="d-alert" style={{margin:'24px 0'}}><ShoppingBag size={22}/><span>{t('POS មិនទាន់រួចរាល់សម្រាប់ការលក់។','POS is not ready for sales yet.')}</span></div><p>{t('ទិន្នន័យសាកល្បងត្រូវបានលុប។ កាតាឡុកទំនិញ វេន និងការបញ្ជាទិញពិត ត្រូវភ្ជាប់ទៅ Supabase មុនចាប់ផ្ដើមលក់។','Sample data has been removed. The real catalog, shifts and orders need to be connected to Supabase before selling.')}</p><a className="d-btn d-btn-primary" style={{marginTop:24}} href="../admin/"><Store size={18}/>{t('បើក Admin','Open Admin')}<ArrowUpRight size={16}/></a><button className="d-btn d-btn-ghost" style={{marginTop:12}} onClick={()=>setLang(lang==='km'?'en':'km')}>{lang==='km'?'English':'ខ្មែរ'}</button></main></div>;
}
