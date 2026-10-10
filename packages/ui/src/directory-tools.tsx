import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { useLanguage } from './shared';

export function DirectoryTools({children}:{children:ReactNode}){
 return <div className="ob-directory-region"><div className="ob-directory-tools">{children}</div></div>;
}
export function DirectorySearch({label,placeholder,value,onChange}:{label:string;placeholder:string;value:string;onChange:(value:string)=>void}){
 const {t}=useLanguage();
 return <label className="access-search ob-directory-search"><Search size={19}/><input className="d-input" type="search" aria-label={label} placeholder={placeholder} value={value} onChange={event=>onChange(event.target.value)}/>{value&&<button type="button" className="d-btn d-btn-ghost d-btn-circle" aria-label={t('សម្អាតការស្វែងរក','Clear search')} onClick={()=>onChange('')}><X size={17}/></button>}</label>;
}
export function DirectorySegments({label,value,options,onChange}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void}){
 return <div className="d-join ob-directory-segments" role="group" aria-label={label}>{options.map(option=><button key={option.value} type="button" className={`d-btn d-join-item ${value===option.value?'d-btn-primary':'d-btn-ghost'}`} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div>;
}
