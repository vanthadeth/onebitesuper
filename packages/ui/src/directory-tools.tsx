import {DropdownRoot,DropdownContent} from './dropdown-menu';
import * as Menu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { Search, X, Eye, EyeOff, Asterisk, Check } from 'lucide-react';
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
 const options=[{value:'active',label:t('ដំណើរការ','Active'),icon:<Eye size={20}/>},{value:'inactive',label:t('ផ្អាក','Inactive'),icon:<EyeOff size={20}/>},{value:'all',label:t('ទាំងអស់','All'),icon:<Asterisk size={20}/>}];
 const selected=options.find(option=>option.value===value)!;
 return <DropdownRoot><Menu.Trigger asChild><button type="button" className="d-btn d-btn-ghost d-btn-square ob-directory-filter" aria-label={label} title={`${label}: ${selected.label}`} data-value={value}>{selected.icon}<span className="ob-sr-only">{selected.label}</span></button></Menu.Trigger>
 <DropdownContent className="ob-directory-filter-menu ob-profile-menu" align="end" sideOffset={8} collisionPadding={12} aria-label={label}>
 <Menu.RadioGroup value={value} onValueChange={selected=>onChange(selected as DirectoryStatus)}>{options.map(option=><Menu.RadioItem key={option.value} value={option.value} className="ob-menu-item ob-directory-filter-option">{option.icon}<span>{option.label}</span><Menu.ItemIndicator className="ob-directory-filter-check"><Check size={17}/></Menu.ItemIndicator></Menu.RadioItem>)}</Menu.RadioGroup>
 </DropdownContent></DropdownRoot>;
}
