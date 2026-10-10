import {useEffect,useRef} from 'react';
import {AlertTriangle,WifiOff} from 'lucide-react';
import {useLanguage} from '@onebite/ui';
export function InventoryMessages({offline,error}:{offline:boolean;error:string}){
 const {t}=useLanguage(),ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const element=ref.current,parent=element?.parentElement;if(!element||!parent)return;
  const measure=()=>parent.style.setProperty('--inventory-message-height',`${element.getBoundingClientRect().height}px`);
  measure();const observer=new ResizeObserver(measure);observer.observe(element);
  return()=>{observer.disconnect();parent.style.removeProperty('--inventory-message-height');};
 },[]);
 return <div ref={ref} className="inventory-messages">
 {offline&&<div className="inventory-notice" role="status"><WifiOff size={16}/><span>{t('គ្មានបណ្ដាញ · រក្សាទុកក្នុងឧបករណ៍ និងសមកាលកម្មពេលភ្ជាប់។','Offline · Saved on this device; syncs when reconnected.')}</span></div>}
 {error&&<div className="inventory-message-error" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>}
 </div>;
}
