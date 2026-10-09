import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@onebite/ui';
export type HubMenuId='users'|'sites'|'roles'|'permissions'|'settings'|'activity';
type HubMenu={id:HubMenuId;label:string;icon:LucideIcon};
export function AdminHub({menus,activeUsers,activeSites,roleCount,onOpen}:{menus:HubMenu[];activeUsers:number;activeSites:number;roleCount:number;onOpen:(id:HubMenuId)=>void}){
 const {t,lang}=useLanguage();
 const descriptions:Record<HubMenuId,string>={
  users:t('ថែរក្សាគណនីក្រុម និងព័ត៌មានអ្នកប្រើ។','Manage your team and their accounts.'),
  sites:t('គ្រប់គ្រងទីតាំង ម៉ោងធ្វើការ និងព័ត៌មានសាខា។','Manage locations, opening hours, and site details.'),
  roles:t('រៀបចំតួនាទី និងការទទួលខុសត្រូវ។','Define your team’s responsibilities.'),
  permissions:t('កំណត់សិទ្ធិប្រើម៉ូឌុល និងសកម្មភាព។','Control module and action access.'),
  settings:t('ព្រំដែនទីតាំង ចំណូលចិត្ត និងអត្រាប្ដូរប្រាក់។','Geofence, preferences, and exchange rate.'),
  activity:t('តាមដានការផ្លាស់ប្ដូរ និងអ្នកធ្វើសកម្មភាព។','See what changed and who made it happen.'),
 };
 const stats:Partial<Record<HubMenuId,{value:number;label:string}>>={
  users:{value:activeUsers,label:t('អ្នកប្រើដំណើរការ','Active users')},
  sites:{value:activeSites,label:t('សាខាដំណើរការ','Active sites')},
  roles:{value:roleCount,label:t('តួនាទី','Roles')},
 };
 const format=new Intl.NumberFormat(lang==='km'?'km-KH':'en');
 return <div className="access-hub-grid" aria-label={t('ម៉ឺនុយគ្រប់គ្រង','Admin menus')}>
  {menus.map(({id,label,icon:Icon})=>{const stat=stats[id];return <button key={id} type="button" aria-label={label} className={`d-card access-hub-card access-hub-${id}`} onClick={()=>onOpen(id)}>
   <span className="access-hub-card-top"><span className="access-hub-symbol"><Icon size={24} aria-hidden="true"/></span><ArrowUpRight className="access-hub-arrow" size={20} aria-hidden="true"/></span>
   {id==='users'&&<Icon className="access-hub-watermark" size={156} strokeWidth={1} aria-hidden="true"/>}
   <span className="access-hub-copy"><strong>{label}</strong><span className="access-hub-description">{descriptions[id]}</span></span>
   {stat&&<span className="access-hub-stat"><b>{format.format(stat.value)}</b><span>{stat.label}</span></span>}
   {id==='activity'&&<span className="access-hub-timeline" aria-hidden="true"><i/><i/><i/><i/></span>}
  </button>;})}
 </div>;
}
