import type { KeyboardEvent } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { LayoutGrid, RefreshCw, Check, CircleAlert, Moon, Sun, LogOut } from 'lucide-react';
import { useLanguage } from './shared';

export type SyncStatus = 'idle' | 'syncing' | 'complete' | 'failed';
export function AppTitleBar({icon,title,name,username,photo,syncStatus,pendingCount,disabled,dark,onSync,onProfile,onHub,onLanguage,onTheme,onSignOut}:{icon:string;title:string;name:string;username:string;photo?:string;syncStatus:SyncStatus;pendingCount:number;disabled:boolean;dark:boolean;onSync:()=>void;onProfile:()=>void;onHub?:()=>void;onLanguage:()=>void;onTheme:()=>void;onSignOut:()=>void}) {
 const {t,lang}=useLanguage();
 const status=syncStatus==='syncing'?t('កំពុងធ្វើសមកាលកម្ម','Syncing'):syncStatus==='complete'?t('សមកាលកម្មរួចរាល់','Sync complete'):syncStatus==='failed'?t('សមកាលកម្មបរាជ័យ','Sync failed'):t('ធ្វើសមកាលកម្ម','Sync');
 const count=t(`${pendingCount} ការផ្លាស់ប្ដូរត្រូវធ្វើសមកាលកម្ម`,`${pendingCount} changes to sync`);
 return <header className="access-header ob-app-header">
  <div className="ob-app-identity"><img src={icon} alt="OneBite"/><div><strong>{title}</strong></div></div>
  <div className="access-header-actions">
   <button type="button" className="ob-sync" data-state={syncStatus} aria-label={`${status} · ${count}`} title={`${status} · ${count}`} disabled={disabled} onClick={onSync}>
    <span className="ob-sync-symbol"><RefreshCw size={28} className="ob-sync-ring"/>{syncStatus==='complete'?<Check className="ob-sync-center" size={12} strokeWidth={3}/>:syncStatus==='failed'?<CircleAlert className="ob-sync-center" size={13}/>:<span className="ob-sync-center ob-sync-count">{pendingCount}</span>}</span>
   </button>
   <span className="ob-sr-only" role="status" aria-live="polite">{status} · {count}</span>
   <Menu.Root><Menu.Trigger asChild><button className="ob-profile-badge" aria-label={t('ម៉ឺនុយគណនី','Profile menu')}><span className="access-avatar small">{photo?<img src={photo} alt=""/>:Array.from(name)[0]}</span></button></Menu.Trigger>
    <Menu.Portal><Menu.Content className="d-menu ob-profile-menu" align="end" sideOffset={10} collisionPadding={12}>
     <Menu.Item className="ob-menu-item ob-profile-label" onSelect={onProfile}><strong>{name}</strong><small>@{username}</small></Menu.Item><Menu.Separator className="ob-menu-separator"/>
     <div className="ob-preference-row"><Menu.Label className="ob-preference-label">{t('ភាសា','Language')}</Menu.Label><Menu.RadioGroup className="ob-menu-segments" aria-label={t('ភាសា','Language')} value={lang} onValueChange={value=>{if(value!==lang)onLanguage();}} onKeyDown={moveSegment}>
      <Menu.RadioItem value="en" className="ob-menu-segment" aria-label="English" onSelect={event=>event.preventDefault()}>EN</Menu.RadioItem>
      <Menu.RadioItem value="km" className="ob-menu-segment" aria-label="ខ្មែរ" onSelect={event=>event.preventDefault()}>ខ្មែរ</Menu.RadioItem>
     </Menu.RadioGroup></div>
     <div className="ob-preference-row"><Menu.Label className="ob-preference-label">{t('រូបរាង','Appearance')}</Menu.Label><Menu.RadioGroup className="ob-menu-segments" aria-label={t('រូបរាង','Appearance')} value={dark?'dark':'light'} onValueChange={value=>{if(value!==(dark?'dark':'light'))onTheme();}} onKeyDown={moveSegment}>
      <Menu.RadioItem value="light" className="ob-menu-segment" aria-label={t('របៀបភ្លឺ','Light mode')} title={t('របៀបភ្លឺ','Light mode')} onSelect={event=>event.preventDefault()}><Sun size={19}/></Menu.RadioItem>
      <Menu.RadioItem value="dark" className="ob-menu-segment" aria-label={t('របៀបងងឹត','Dark mode')} title={t('របៀបងងឹត','Dark mode')} onSelect={event=>event.preventDefault()}><Moon size={19}/></Menu.RadioItem>
     </Menu.RadioGroup></div>
     {onHub&&<Menu.Item className="ob-menu-item" onSelect={onHub}><LayoutGrid size={18}/>{t('មជ្ឈមណ្ឌល','Hub')}</Menu.Item>}
     <Menu.Separator className="ob-menu-separator"/><Menu.Item disabled={disabled} className="ob-menu-item ob-menu-danger" onSelect={onSignOut}><LogOut size={18}/>{t('ចាកចេញ','Sign out')}</Menu.Item>
    </Menu.Content></Menu.Portal>
   </Menu.Root>
  </div>
 </header>;
}

// Horizontal arrows select within a pair; vertical arrows keep Radix menu navigation.
function moveSegment(event:KeyboardEvent<HTMLDivElement>){
 if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
 const options=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
 const current=event.target instanceof HTMLElement?event.target.closest('[role="menuitemradio"]'):null;
 const index=options.findIndex(option=>option===current);if(index<0)return;
 event.preventDefault();event.stopPropagation();const next=options[(index+(event.key==='ArrowRight'?1:-1)+options.length)%options.length];next.focus();next.click();
}
