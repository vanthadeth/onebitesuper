import * as Menu from '@radix-ui/react-dropdown-menu';
import { Cloud, CloudCheck, CloudAlert, CloudOff, RefreshCw, Wifi, WifiOff, Check, CircleAlert, Clock3, X } from 'lucide-react';
import { useLanguage } from './shared';
import './sync-status.css';

export type SyncStatus = 'idle' | 'syncing' | 'complete' | 'failed';
export type ConnectionStatus = 'online' | 'offline' | 'unreachable';
export type SyncTask = 'refresh' | 'save';
export function SyncControl({status,pendingCount,connection,task,lastSyncedAt,disabled,onSync,offlineWrites=false}:{status:SyncStatus;pendingCount:number;connection:ConnectionStatus;task:SyncTask;lastSyncedAt?:number;disabled:boolean;offlineWrites?:boolean;onSync:()=>void}){
 const {t,lang}=useLanguage();
 const paused=connection!=='online'&&status!=='syncing';
 const label=paused?t('ផ្អាកសមកាលកម្ម','Sync paused'):status==='syncing'?pendingCount>0?t('កំពុងរក្សាទុក…','Saving…'):t('កំពុងធ្វើបច្ចុប្បន្នភាព…','Updating…'):status==='complete'?t('ទិន្នន័យថ្មីបំផុត','Up to date'):status==='failed'?task==='save'?t('មិនទាន់បានរក្សាទុក','Not saved'):t('មិនអាចធ្វើបច្ចុប្បន្នភាព','Update failed'):t('ធ្វើសមកាលកម្ម','Sync');
 const detail=paused?(offlineWrites?t('ការផ្លាស់ប្ដូររក្សាទុកក្នុងឧបករណ៍។ ភ្ជាប់ឡើងវិញដើម្បីធ្វើសមកាលកម្ម។','Changes are saved on this device. Reconnect to publish them.'):t('មើលទិន្នន័យដែលបានរក្សាទុក។ ភ្ជាប់ឡើងវិញដើម្បីកែប្រែ។','View saved data. Reconnect to make changes.')):status==='syncing'?pendingCount>0?t(`កំពុងរក្សាទុក ${pendingCount} ការផ្លាស់ប្ដូរ។`,`Saving ${pendingCount} ${pendingCount===1?'change':'changes'}.`):t('កំពុងពិនិត្យទិន្នន័យថ្មីបំផុត។','Checking for the latest saved data.'):status==='failed'?task==='save'?t('ការផ្លាស់ប្ដូរមិនទាន់បានរក្សាទុក។ ពិនិត្យសារកំហុស ហើយព្យាយាមក្នុងផ្ទាំងកែប្រែម្ដងទៀត។','Your change was not saved. Check the error and retry in the editor.'):t('មិនអាចទទួលទិន្នន័យថ្មី។ សូមព្យាយាមម្ដងទៀត។','Could not fetch the latest data. Please try again.'):status==='complete'?t('ទិន្នន័យដែលបានរក្សាទុកថ្មីបំផុត មាននៅលើឧបករណ៍នេះ។','The latest saved data is on this device.'):t('ពិនិត្យទិន្នន័យថ្មីពីក្រុមរបស់អ្នក។','Check for updates from your team.');
 const connectionLabel=connection==='online'?t('មានអ៊ីនធឺណិត','Online'):connection==='offline'?t('គ្មានអ៊ីនធឺណិត','Offline'):t('មិនអាចភ្ជាប់សេវា','Connection lost');
 const Icon=paused?CloudOff:status==='complete'?CloudCheck:status==='failed'?CloudAlert:Cloud;
 const tone=paused?'paused':status;
 const timestamp=lastSyncedAt?new Intl.DateTimeFormat(lang==='km'?'km-KH':'en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Asia/Phnom_Penh'}).format(lastSyncedAt):t('មិនទាន់មាន','Not yet');
 return <div className="ob-sync-controls">
  <Menu.Root><Menu.Trigger asChild><button type="button" className="d-btn d-btn-ghost ob-connection" data-connection={connection} aria-label={`${t('ស្ថានភាពការតភ្ជាប់','Connection status')}: ${connectionLabel}`} title={connectionLabel}><span className="ob-connection-icon">{connection==='offline'?<WifiOff size={19}/>:<Wifi size={19}/>}<span className="d-status ob-network-dot"/></span><span className="ob-connection-label">{connectionLabel}</span></button></Menu.Trigger>
   <Menu.Portal><Menu.Content className="d-card ob-sync-popover" align="end" sideOffset={12} collisionPadding={16} aria-label={t('ការតភ្ជាប់ និងសមកាលកម្ម','Connection and sync')}>
    <Menu.Label className="ob-sync-popover-heading"><span className={`ob-sync-state-icon ${tone}`}><Icon size={24}/></span><span><strong>{label}</strong><span className={`d-badge d-badge-soft ob-network-badge ${connection}`}>{connectionLabel}</span></span></Menu.Label>
    <p className="ob-sync-description">{detail}</p>
    {status==='syncing'&&<progress className="d-progress d-progress-primary ob-sync-progress" aria-label={t('កំពុងធ្វើសមកាលកម្ម','Sync in progress')}/>}
    <dl className="ob-sync-facts"><div><dt><Clock3 size={16}/>{t('ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ','Last updated')}</dt><dd>{timestamp}</dd></div><div><dt>{t('ការផ្លាស់ប្ដូរកំពុងរក្សាទុក','Changes being saved')}</dt><dd>{pendingCount}</dd></div></dl>
    <Menu.Separator className="ob-menu-separator"/>
    <Menu.Item className="d-btn d-btn-primary ob-sync-now" disabled={disabled||status==='syncing'} onSelect={onSync}><RefreshCw size={17}/>{paused?t('ភ្ជាប់ឡើងវិញ','Reconnect'):t('ធ្វើសមកាលកម្មឥឡូវ','Sync now')}</Menu.Item>
   </Menu.Content></Menu.Portal>
  </Menu.Root>
  <button type="button" className="d-btn d-btn-ghost ob-sync" data-state={status} data-tone={tone} aria-label={`${label} · ${pendingCount} ${t('ការផ្លាស់ប្ដូរកំពុងរក្សាទុក','changes being saved')}`} title={detail} aria-busy={status==='syncing'} disabled={disabled||status==='syncing'} onClick={onSync}>
   <span className="ob-sync-symbol">{status==='syncing'?<span className="d-loading d-loading-spinner ob-sync-spinner"/>:<Icon size={25}/>}</span><span className="ob-sync-label">{label}</span>{pendingCount>0&&<span className="d-badge d-badge-primary ob-sync-count">{pendingCount}</span>}
  </button>
  <span className="ob-sr-only" role="status" aria-live="polite" aria-atomic="true">{connectionLabel} · {label}. {detail}</span>
 </div>;
}

export function ConnectionNotice({connection,busy,onReconnect}:{connection:ConnectionStatus;busy:boolean;onReconnect:()=>void}){
 const {t}=useLanguage();if(connection==='online')return null;
 return <div className="d-alert d-alert-warning d-alert-soft access-offline-notice ob-connection-notice" role="status"><span className="ob-notice-symbol"><WifiOff size={21}/></span><div><strong>{connection==='offline'?t('អ្នកកំពុងនៅក្រៅបណ្ដាញ','You’re offline'):t('មិនអាចភ្ជាប់សេវា','Connection lost')}</strong><p>{t('មើលទិន្នន័យដែលបានរក្សាទុក។ ភ្ជាប់ឡើងវិញដើម្បីកែប្រែ។','View saved data. Reconnect to make changes.')}</p></div><button type="button" className="d-btn d-btn-outline" disabled={busy} onClick={onReconnect}>{busy?<span className="d-loading d-loading-spinner"/>:<RefreshCw size={16}/>} {t('ភ្ជាប់ឡើងវិញ','Reconnect')}</button></div>;
}

export function SyncToast({message,tone='success',onDismiss}:{message:string;tone?:'success'|'info'|'warning'|'error';onDismiss?:()=>void}){
 const {t}=useLanguage(),toneClass={success:'d-alert-success',info:'d-alert-info',warning:'d-alert-warning',error:'d-alert-error'}[tone];return <div className="ob-feedback-toast"><div className={`d-alert ${toneClass} d-alert-soft ob-feedback-message`} role={tone==='error'?'alert':'status'}><span className="ob-feedback-icon">{tone==='success'?<Check size={19}/>:<CircleAlert size={19}/>}</span><span>{message}</span>{onDismiss&&<button type="button" className="d-btn d-btn-ghost d-btn-square" aria-label={t('បិទសារ','Dismiss message')} onClick={onDismiss}><X size={17}/></button>}</div></div>;
}
