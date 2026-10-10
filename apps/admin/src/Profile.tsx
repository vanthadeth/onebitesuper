import { Building2, Check, Globe2, KeyRound, LogOut, MapPin, Moon, Pencil, ShieldCheck, Sun, UserRound, LockKeyhole, ArrowUpRight, Camera } from 'lucide-react';
import { useLanguage } from '@onebite/ui';
import { hasPermission, permissionAvailable, moduleDefinitions, type Account, type AccessState } from '@onebite/core/access';
import './profile.css';
import { version } from '../../../package.json';

type Props = {
 account: Account; state: AccessState; roleName: string; dark: boolean; live: boolean; busy: boolean;
 onLanguage: () => void; onTheme: () => void; onSignOut: () => void;
 photo?: string; onPhoto?: () => void;
 onEdit?: () => void; onResetPin?: () => void;
};
export function ProfilePage({account,state,roleName,dark,live,busy,onLanguage,onTheme,onSignOut,onEdit,onResetPin,photo,onPhoto}:Props){
 const {t,lang}=useLanguage();
 const sites=state.sites.filter(site=>account.role==='Owner'||account.sites.includes(site.id));
 const needsMfa=account.role==='Owner';
 return <div className="profile-grid">
  <section className="d-card profile-card profile-identity" aria-labelledby="profile-identity-title">
   <div className="profile-identity-top"><span className="profile-overline">ONEBITE TEAM</span><span className="d-badge profile-active"><span/>{t('ដំណើរការ','Active')}</span></div>
   <div className="profile-avatar" aria-hidden="true">{photo?<img src={photo} alt=""/>:Array.from(account.name)[0]}</div>
   <button type="button" className="d-btn d-btn-ghost profile-photo-action" disabled={busy||!live||!onPhoto} onClick={onPhoto}><Camera size={17}/>{account.photoPath?t('ប្ដូររូបថត','Change photo'):t('បញ្ចូលរូបថត','Add photo')}</button>
   <div className="profile-identity-copy"><h2 id="profile-identity-title">{account.name}</h2><p>@{account.username}</p><span className="d-badge profile-role"><ShieldCheck size={14}/>{roleName}</span></div>
   <div className="profile-identity-bottom"><span>{t('គណនីរបស់អ្នក','Your personal account')}</span>{onEdit&&<button type="button" className="d-btn d-btn-ghost" disabled={busy} onClick={onEdit}><Pencil size={16}/>{t('កែប្រែ','Edit profile')}</button>}</div>
  </section>

  <section className="d-card profile-card profile-preferences" aria-labelledby="profile-preferences-title">
   <div className="profile-card-heading"><span className="profile-symbol"><Sun size={20}/></span><div><h2 id="profile-preferences-title">{t('តាមចំណូលចិត្តអ្នក','Make it yours')}</h2><p>{t('ចំណូលចិត្តសម្រាប់ឧបករណ៍នេះ។','Preferences for this device.')}</p></div></div>
   <div className="profile-setting"><span><Globe2 size={18}/><span>{t('ភាសា','Language')}<small>{lang==='km'?'ខ្មែរ':'English'}</small></span></span><button type="button" className="d-btn d-btn-outline profile-choice" onClick={onLanguage} aria-label={t('ប្ដូរភាសា','Switch language')}>{lang==='km'?'English':'ខ្មែរ'}<ArrowUpRight size={15}/></button></div>
   <div className="profile-setting"><span>{dark?<Moon size={18}/>:<Sun size={18}/>}<span>{t('រូបរាង','Appearance')}<small>{dark?t('ងងឹត','Dark'):t('ភ្លឺ','Light')}</small></span></span><button type="button" className="d-btn d-btn-outline profile-choice" role="switch" aria-checked={dark} aria-label={t('រូបរាងងងឹត','Dark mode')} onClick={onTheme}>{dark?<Sun size={16}/>:<Moon size={16}/>} {dark?t('ភ្លឺ','Light'):t('ងងឹត','Dark')}</button></div>
  </section>

  <section className="d-card profile-card profile-security" aria-labelledby="profile-security-title">
   <div className="profile-card-heading"><span className="profile-symbol"><LockKeyhole size={20}/></span><div><h2 id="profile-security-title">{t('ការពារគណនី','Account security')}</h2><p>{live?t('រក្សាសិទ្ធិចូលប្រើរបស់អ្នកឱ្យមានសុវត្ថិភាព។','Keep your account access secure.'):t('អាចមើលទិន្នន័យបានតែប៉ុណ្ណោះពេលគ្មានអ៊ីនធឺណិត។','Offline data is read-only.')}</p></div></div>
   <div className="profile-security-note"><ShieldCheck size={23}/><div><strong>{needsMfa?t('តម្រូវឱ្យមាន Authenticator','Authenticator required'):t('ចូលប្រើដោយ PIN ផ្ទាល់ខ្លួន','Personal PIN sign-in')}</strong><p>{needsMfa?t('តួនាទីនេះត្រូវការបញ្ជាក់អត្តសញ្ញាណមុនធ្វើសកម្មភាពសំខាន់ៗ។','This role requires verification for sensitive actions.'):t('កុំចែករំលែក PIN របស់អ្នកជាមួយអ្នកដទៃ។','Keep your PIN private and use your own account.')}</p></div></div>
   {onResetPin&&<button type="button" className="d-btn d-btn-outline profile-security-action" disabled={busy||!live} onClick={onResetPin}><KeyRound size={17}/>{t('កំណត់ PIN ឡើងវិញ','Reset PIN')}<ArrowUpRight size={16}/></button>}
   <small>{t('រក្សាការចូលប្រើរយៈពេល 7 ថ្ងៃ។','Sign-in remembered for 7 days.')}</small>
  </section>

  <section className="d-card profile-card profile-sites" aria-labelledby="profile-sites-title">
   <div className="profile-card-heading"><span className="profile-symbol"><Building2 size={20}/></span><div><h2 id="profile-sites-title">{t('សាខារបស់អ្នក','Your sites')}</h2><p>{account.role==='Owner'?t('ចូលប្រើគ្រប់សាខាក្នុងនាមម្ចាស់។','Access to every site as Owner.'):t('ទីតាំងដែលអ្នកត្រូវបានចាត់តាំង។','The locations you are assigned to.')}</p></div><span className="d-badge d-badge-soft">{sites.length}</span></div>
   {sites.length?<ul className="profile-site-list">{sites.map(site=><li key={site.id}><span className="profile-site-icon"><MapPin size={18}/></span><div><strong>{site.name}</strong><small>{site.location||t('មិនទាន់មានទីតាំង','Location not added')}</small></div><span className={`d-badge d-badge-soft access-status ${site.active?'active':'inactive'}`}>{site.active?t('ដំណើរការ','Active'):t('ផ្អាក','Inactive')}</span></li>)}</ul>:<div className="profile-empty"><MapPin size={26}/><strong>{t('មិនទាន់បានចាត់តាំងសាខា','No sites assigned yet')}</strong><p>{t('សូមទាក់ទងអ្នកត្រួតពិនិត្យ ឬម្ចាស់ ដើម្បីចាត់តាំងសាខា។','Ask your supervisor or Owner to assign your sites.')}</p></div>}
  </section>

  <section className="d-card profile-card profile-access" aria-labelledby="profile-access-title">
   <div className="profile-card-heading"><span className="profile-symbol"><UserRound size={20}/></span><div><h2 id="profile-access-title">{t('សិទ្ធិម៉ូឌុល','Module access')}</h2><p>{t('កំណត់តាមតួនាទីរបស់អ្នក។','Defined by your role.')}</p></div></div>
   <ul className="profile-module-list">{moduleDefinitions.map(module=>{const available=permissionAvailable(module.id),allowed=hasPermission(state.grants[account.role],account.role,module.id);return <li key={module.id}><span>{t(module.km,module.en)}</span><span className={`d-badge d-badge-soft ${allowed?'profile-allowed':'profile-denied'}`}>{allowed&&<Check size={13}/>} {!available?t('មិនទាន់អាចប្រើបាន','Unavailable'):allowed?t('អនុញ្ញាត','Allowed'):t('បដិសេធ','Denied')}</span></li>;})}</ul>
  </section>

  <section className="d-card profile-card profile-session" aria-labelledby="profile-session-title">
   <div><h2 id="profile-session-title">{t('សម័យចូលប្រើនេះ','This session')}</h2><p>{live?t('ចាកចេញពេលអ្នកបានបញ្ចប់ការងារ។','Sign out when you’re done on this device.'):t('អ្នកកំពុងមើលទិន្នន័យ Supabase ដែលបានរក្សាទុក។','You’re viewing saved Supabase data.')}</p><small>OneBite - Admin · v{version}</small></div>
   <button type="button" className="d-btn d-btn-outline profile-signout" disabled={busy} onClick={onSignOut}><LogOut size={18}/>{t('ចាកចេញ','Sign out')}</button>
  </section>
 </div>;
}
