import { useLanguage } from './shared';

export function ActiveStatusBadge({active,dot=true,className=''}:{active:boolean;dot?:boolean;className?:string}){
 const {t}=useLanguage();
 return <span className={`d-badge d-badge-soft ob-active-status access-status ${active?'active':'inactive'} ${className}`}>{dot&&<i aria-hidden="true"/>}{active?t('ដំណើរការ','Active'):t('ផ្អាក','Inactive')}</span>;
}
