import * as Menu from '@radix-ui/react-dropdown-menu';
import { RefreshCw, Check, CircleAlert, UserRound, Languages, Moon, Sun, LogOut } from 'lucide-react';
import { useLanguage } from './shared';

export type SyncStatus = 'idle' | 'syncing' | 'complete' | 'failed';
export function AppTitleBar({icon,title,name,username,syncStatus,pendingCount,disabled,dark,onSync,onProfile,onLanguage,onTheme,onSignOut}:{icon:string;title:string;name:string;username:string;syncStatus:SyncStatus;pendingCount:number;disabled:boolean;dark:boolean;onSync:()=>void;onProfile:()=>void;onLanguage:()=>void;onTheme:()=>void;onSignOut:()=>void}) {
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
   <Menu.Root><Menu.Trigger asChild><button className="ob-profile-badge" aria-label={t('ម៉ឺនុយគណនី','Profile menu')}><span className="access-avatar small">{Array.from(name)[0]}</span></button></Menu.Trigger>
    <Menu.Portal><Menu.Content className="ob-profile-menu" align="end" sideOffset={10} collisionPadding={12}>
     <Menu.Label className="ob-profile-label"><strong>{name}</strong><small>@{username}</small></Menu.Label><Menu.Separator className="ob-menu-separator"/>
     <Menu.Item className="ob-menu-item" onSelect={onProfile}><UserRound size={18}/>{t('ប្រវត្តិរូបរបស់ខ្ញុំ','My profile')}</Menu.Item>
     <Menu.Item className="ob-menu-item" onSelect={onLanguage}><Languages size={18}/>{lang==='km'?'English':'ខ្មែរ'}</Menu.Item>
     <Menu.Item className="ob-menu-item" onSelect={onTheme}>{dark?<Sun size={18}/>:<Moon size={18}/ >}{dark?t('របៀបភ្លឺ','Light mode'):t('របៀបងងឹត','Dark mode')}</Menu.Item>
     <Menu.Separator className="ob-menu-separator"/><Menu.Item disabled={disabled} className="ob-menu-item ob-menu-danger" onSelect={onSignOut}><LogOut size={18}/>{t('ចាកចេញ','Sign out')}</Menu.Item>
    </Menu.Content></Menu.Portal>
   </Menu.Root>
  </div>
 </header>;
}
