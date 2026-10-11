import type { ReactNode } from 'react';
import { Search, X, Eye, EyeOff, Asterisk } from 'lucide-react';
import { useLanguage } from './shared';

export function DirectoryTools({children}:{children:ReactNode}){
 return <div className="ob-directory-region"><div className="ob-directory-tools">{children}</div></div>;
}
export function DirectorySearch({label,placeholder,value,onChange}:{label:string;placeholder:string;value:string;onChange:(value:string)=>void}){
 const {t}=useLanguage();
 return <label className="access-search ob-directory-search"><Search size={19}/><input className="d-input" type="search" aria-label={label} placeholder={placeholder} value={value} onChange={event=>onChange(event.target.value)}/>{value&&<button type="button" className="d-btn d-btn-ghost d-btn-circle" aria-label={t('សម្អាតការស្វែងរក','Clear search')} onClick={()=>onChange('')}><X size={17}/></button>}</label>;
}
export function CategoryFilter({label,value,options,onChange,className=''}:{label:string;value:string;options:{value:string;label:string;icon?:ReactNode}[];onChange:(value:string)=>void;className?:string}){
 return <div className={`ob-category-filter ${className}`} role="group" aria-label={label}>{options.map(option=><button key={option.value} type="button" className={`ob-category-option ${value===option.value?'is-selected':''}`} aria-pressed={value===option.value} onClick={event=>{onChange(option.value);event.currentTarget.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});}}>{option.icon}{option.label}</button>)}</div>;
}
export type DirectoryStatus = 'active'|'inactive'|'all';
export function DirectoryStatusFilter({label,value,onChange}:{label:string;value:DirectoryStatus;onChange:(value:DirectoryStatus)=>void}){
 const {t}=useLanguage();
 return <CategoryFilter className="ob-status-filter" label={label} value={value} options={[{value:'active',label:t('ដំណើរការ','Active'),icon:<Eye size={20}/>},{value:'inactive',label:t('ផ្អាក','Inactive'),icon:<EyeOff size={20}/>},{value:'all',label:t('ទាំងអស់','All'),icon:<Asterisk size={20}/>}]} onChange={selected=>onChange(selected as DirectoryStatus)}/>;
}
