import {AlertTriangle,WifiOff} from 'lucide-react';
import {useLanguage} from '@onebite/ui';
export function InventoryMessages({offline,error}:{offline:boolean;error:string}){
 const {t}=useLanguage();
 if(!offline&&!error)return null;
 return <div className="inventory-messages">
 {offline&&<div className="inventory-notice" role="status"><WifiOff size={16}/><span>{t('គ្មានបណ្ដាញ · រក្សាទុកក្នុងឧបករណ៍ និងសមកាលកម្មពេលភ្ជាប់។','Offline · Saved on this device; syncs when reconnected.')}</span></div>}
 {error&&<div className="inventory-message-error" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>}
 </div>;
}
