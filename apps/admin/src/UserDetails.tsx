import { Crown, ShieldCheck, Store, MapPin, Users, Check, LockKeyhole } from 'lucide-react';
import { ActiveStatusBadge, AppDialog, useLanguage } from '@onebite/ui';
import { hasPermission, moduleDefinitions, permissionAvailable, type Account, type AccessState } from '@onebite/core/access';
import type { ReactNode } from 'react';
import { AccountAvatar } from './profile-photo';
import './user-details.css';

export function UserDetails({account,state,roleName,session,online,footer,onClose}:{account:Account;state:AccessState;roleName:string;session:string;online:boolean;footer?:ReactNode;onClose:()=>void}){
 const {t}=useLanguage();
 const sites=state.sites.filter(site=>account.role==='Owner'||account.sites.includes(site.id));
 const RoleIcon=account.role==='Owner'?Crown:account.role==='Supervisor'?ShieldCheck:Users;
 const modules=moduleDefinitions.filter(module=>hasPermission(state.grants[account.role]||[],account.role,module.id));
 return <AppDialog title={t('ព័ត៌មានអ្នកប្រើ','User details')} onClose={onClose} footer={footer}>
  <div className="user-details-grid">
   <section className="d-card user-details-identity" aria-label={t('គណនី','Account')}><AccountAvatar id={account.id} name={account.name} className="user-details-avatar"/><div><h3>{account.name}</h3><p>@{account.username}</p></div></section>
   <section className="d-card user-details-tile"><span className="user-details-symbol"><RoleIcon size={20}/></span><dl><dt>{t('តួនាទី','Role')}</dt><dd>{roleName}</dd></dl></section>
   <section className="d-card user-details-tile"><span className={`user-details-symbol ${account.active?'is-active':'is-inactive'}`}><Check size={20}/></span><dl><dt>{t('ស្ថានភាព','Status')}</dt><dd><ActiveStatusBadge active={account.active}/></dd></dl></section>
   <section className="d-card user-details-sites" aria-labelledby="user-details-sites-title"><div className="user-details-heading"><Store size={19}/><h3 id="user-details-sites-title">{t('សាខាដែលបានចាត់តាំង','Assigned sites')}</h3><span className="d-badge d-badge-soft">{sites.length}</span></div>
    {account.role==='Owner'&&<p className="user-details-caption">{t('គ្រប់សាខា','All sites')}</p>}
    {sites.length?<ul>{sites.map(site=><li key={site.id}><MapPin size={18}/><div><strong>{site.name}</strong><small>{site.location||t('មិនទាន់មានទីតាំង','Location not added')}</small></div><ActiveStatusBadge active={site.active} dot={false}/></li>)}</ul>:<div className="user-details-empty"><MapPin size={24}/><strong>{t('គ្មានសាខា','No sites')}</strong><p>{t('ចាត់តាំងសាខាដើម្បីឱ្យបុគ្គលិកអាចចាប់ផ្ដើមការងារ។','Assign a site so this team member can get started.')}</p></div>}
   </section>
   <section className="d-card user-details-access"><div className="user-details-heading"><LockKeyhole size={19}/><h3>{t('ម៉ូឌុលដែលអនុញ្ញាត','Allowed modules')}</h3></div>{modules.length?<ul>{modules.map(module=><li key={module.id} className={permissionAvailable(module.id)?'':'unavailable'}><ShieldCheck size={16}/>{t(module.km,module.en)}{!permissionAvailable(module.id)&&<small>{t('មិនទាន់អាចប្រើបាន','Unavailable')}</small>}</li>)}</ul>:<p className="user-details-caption">{t('មិនមានម៉ូឌុលដែលអនុញ្ញាត','No modules allowed')}</p>}</section>
  </div>
 </AppDialog>;
}
