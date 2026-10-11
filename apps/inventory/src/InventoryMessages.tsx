import {useEffect,useState} from 'react';
import {SyncToast,useLanguage} from '@onebite/ui';
export function InventoryMessages({offline,error,toast,onDismiss}:{offline:boolean;error:string;toast:string;onDismiss:()=>void}){
 const {t}=useLanguage(),[dismissedError,setDismissedError]=useState('');
 useEffect(()=>setDismissedError(''),[error]);
 return <>
 {toast&&<SyncToast message={toast} tone="info" onDismiss={onDismiss}/>}
 {offline&&<SyncToast tone="warning" message={t('គ្មានបណ្ដាញ · រក្សាទុកក្នុងឧបករណ៍ និងសមកាលកម្មពេលភ្ជាប់។','Offline · Saved on this device; syncs when reconnected.')}/>}
 {error&&error!==dismissedError&&<SyncToast tone="error" message={error} onDismiss={()=>setDismissedError(error)}/>}
 </>;
}
