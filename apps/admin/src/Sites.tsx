import { useId, useRef, useState, type ReactNode } from 'react';
import { Store, MapPin, Plus, Check, Clock, CalendarDays, Pencil, LocateFixed, ChevronDown, ImagePlus, Trash2, LoaderCircle } from 'lucide-react';
import { useLanguage, EmptyState, AppDialog, SwitchField, CheckField } from '@onebite/ui';
import { sitePhotoUrl } from './site-photo';
import { normalizeSite, siteDraft, type AccessSite, type SiteDraft } from '@onebite/core/access';

export function SiteDirectory({sites,onCreate,onEdit,readOnly=false}:{sites:AccessSite[];onCreate?:()=>void;onEdit:(site:AccessSite)=>void;readOnly?:boolean}){
 const {t,lang}=useLanguage();const order=new Intl.Collator(lang==='km'?'km-KH':'en',{sensitivity:'base',numeric:true});
 return sites.length?<div className="access-sites-list">{[...sites].sort((a,b)=>order.compare(a.name,b.name)).map(site=><button className="d-card access-site-row" key={site.id} onClick={()=>onEdit(site)} aria-label={`${readOnly?t('មើលសាខា','View site'):t('កែប្រែសាខា','Edit site')} ${site.name}`}><span className="access-site-photo">{sitePhotoUrl(site.photoPath)?<img src={sitePhotoUrl(site.photoPath)} alt={site.name} loading="lazy"/>:<span className="access-site-photo-placeholder" aria-label={t('មិនទាន់មានរូបថតសាខា','No site photo added')}><Store size={42} strokeWidth={1.3}/></span>}<span className={`d-badge d-badge-soft access-status ${site.active?'active':'inactive'}`}><i/>{site.active?t('ដំណើរការ','Active'):t('ផ្អាក','Inactive')}</span></span><span className="access-site-copy"><strong>{site.name}</strong><small><MapPin size={15}/>{site.location||t('មិនទាន់មានទីតាំង','Location not added yet')}</small></span></button>)}</div>:<EmptyState icon={<Store size={30}/>} title={t('បង្កើតសាខា OneBite ដំបូង','Give OneBite a place to grow')} body={t('បន្ថែមទីតាំងដំបូង និងព័ត៌មានប្រតិបត្តិការ។','Add your first location and its operating details.')} action={onCreate?{label:t('បង្កើតសាខាថ្មី','New Site'),icon:<Plus size={18}/>,onClick:onCreate}:undefined}/>;
}

export function SiteEditor({site,creating,busy,error,recovery,onClose,onSave,onUploadPhoto}:{site:AccessSite;creating:boolean;busy:boolean;error:string;recovery?:ReactNode;onClose:()=>void;onSave:(site:SiteDraft)=>Promise<void>;onUploadPhoto:(file:File)=>Promise<string>}){
 const {t}=useLanguage();const [draft,setDraft]=useState(()=>siteDraft(site));const formId=useId();
 const photoInput=useRef<HTMLInputElement>(null);const [uploading,setUploading]=useState(false),[photoError,setPhotoError]=useState('');
 async function choosePhoto(file?:File){if(!file)return;setUploading(true);setPhotoError('');try{const photoPath=await onUploadPhoto(file);setDraft(old=>({...old,photoPath}));}catch(e){setPhotoError(e instanceof Error&&'code' in e&&e.code==='invalid_photo'?t('សូមជ្រើសរូបភាព JPG, PNG ឬ WebP មិនលើស 15 MB។','Choose a JPG, PNG or WebP image up to 15 MB.'):t('មិនអាចបង្ហោះរូបភាពបាន។ សូមព្យាយាមម្ដងទៀត។','Could not upload the photo. Please try again.'));}finally{setUploading(false);}}
 const [hoursMode,setHoursMode]=useState<'same'|'different'>(()=>site.workingHours?.length===7&&site.workingHours.every(h=>h.opens===site.workingHours![0].opens&&h.closes===site.workingHours![0].closes)?'same':'different');
 const [locating,setLocating]=useState(false),[locationMessage,setLocationMessage]=useState(''),[locationError,setLocationError]=useState(false);
 function useCurrentLocation(){
  setLocationMessage('');setLocationError(false);
  if(!navigator.geolocation){setLocationError(true);setLocationMessage(t('ឧបករណ៍នេះមិនគាំទ្រទីតាំង','Location is not supported on this device.'));return;}
  setLocating(true);
  navigator.geolocation.getCurrentPosition(position=>{setDraft(old=>({...old,latitude:Number(position.coords.latitude.toFixed(6)),longitude:Number(position.coords.longitude.toFixed(6))}));setLocating(false);setLocationMessage(t('បានបញ្ចូលទីតាំងបច្ចុប្បន្ន','Current location added.'));},error=>{setLocating(false);setLocationError(true);setLocationMessage(error.code===1?t('សូមអនុញ្ញាតទីតាំងក្នុងការកំណត់កម្មវិធីរុករក ឬបញ្ចូលដោយដៃ','Location access was denied. Allow it in browser settings or enter coordinates manually.'):error.code===3?t('ការស្វែងរកទីតាំងបានហួសពេល។ សូមព្យាយាមម្ដងទៀត។','Location timed out. Please try again.'):t('មិនអាចរកទីតាំងបាន។ សូមព្យាយាមម្ដងទៀត ឬបញ្ចូលដោយដៃ។','Could not find your location. Try again or enter coordinates manually.'));},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
 }
 const update=(patch:Partial<SiteDraft>)=>setDraft(old=>({...old,...patch}));
 let valid=true;try{normalizeSite(draft);}catch{valid=false;}
 const days=[t('ចន្ទ','Monday'),t('អង្គារ','Tuesday'),t('ពុធ','Wednesday'),t('ព្រហស្បតិ៍','Thursday'),t('សុក្រ','Friday'),t('សៅរ៍','Saturday'),t('អាទិត្យ','Sunday')];
 const useSameHours=()=>{const hours=draft.workingHours[0]??{opens:'16:00',closes:'22:00'};update({workingHours:days.map((_,day)=>({day,opens:hours.opens,closes:hours.closes}))});setHoursMode('same');};
 const changeSharedHours=(patch:{opens?:string;closes?:string})=>update({workingHours:draft.workingHours.map(h=>({...h,...patch}))});
 const changeHours=(day:number,patch:{opens?:string;closes?:string})=>update({workingHours:draft.workingHours.map(h=>h.day===day?{...h,...patch}:h)});
 return <AppDialog title={creating?t('បង្កើតសាខាថ្មី','New Site'):t('កែប្រែសាខា','Edit site')} onClose={()=>{if(!busy&&!uploading)onClose();}} footer={<button form={formId} type="submit" className="d-btn d-btn-primary access-btn" disabled={busy||locating||uploading||!valid}>{creating?<Plus size={18}/>:<Check size={18}/>} {busy?t('កំពុងរក្សាទុក…','Saving…'):creating?t('បង្កើតសាខា','Create Site'):t('រក្សាទុក','Save changes')}</button>}>
  <form id={formId} className="access-form access-site-form" onSubmit={e=>{e.preventDefault();if(valid&&!busy&&!locating&&!uploading)void onSave(draft);}}>
   <section className="access-site-section access-site-photo-editor"><h3><ImagePlus size={18}/>{t('រូបភាពសាខា','Site photo')}<small>{t('ស្រេចចិត្ត','Optional')}</small></h3>
    <div className="access-site-photo-preview">{sitePhotoUrl(draft.photoPath)?<img src={sitePhotoUrl(draft.photoPath)} alt={t('រូបភាពសាខា','Site photo')}/>:<div><Store size={40}/><span>{t('បន្ថែមរូបភាពសាខារបស់អ្នក','Add a picture of your site')}</span></div>}</div>
    <input ref={photoInput} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label={t('ជ្រើសរូបភាពសាខា','Choose site photo')} onChange={e=>{void choosePhoto(e.target.files?.[0]);e.target.value='';}}/>
    <div className="access-site-photo-actions"><button type="button" className="d-btn d-btn-outline access-btn secondary" disabled={busy||uploading} onClick={()=>photoInput.current?.click()}>{uploading?<LoaderCircle size={18} className="access-photo-spinner"/>:<ImagePlus size={18}/>} {uploading?t('កំពុងបង្ហោះ…','Uploading…'):draft.photoPath?t('ប្ដូររូបភាព','Replace photo'):t('បង្ហោះរូបភាព','Upload photo')}</button>{draft.photoPath&&<button type="button" className="d-btn d-btn-ghost access-btn secondary" disabled={busy||uploading} onClick={()=>{update({photoPath:null});setPhotoError('');}}><Trash2 size={18}/>{t('លុបរូបភាព','Remove photo')}</button>}</div>
    <p className="access-helper">{t('JPG, PNG ឬ WebP · មិនលើស 15 MB។ រូបភាពត្រូវបានបង្រួមមុនបង្ហោះ។','JPG, PNG or WebP · Up to 15 MB. Pictures are compressed before uploading.')}</p>{photoError&&<p className="access-error" role="alert">{photoError}</p>}
   </section>
   <section className="access-site-section"><h3><MapPin size={18}/>{t('ព័ត៌មានសាខា','Site information')}</h3>
    <label>{t('ឈ្មោះ','Name')}<input className="d-input" required maxLength={100} value={draft.name} onChange={e=>update({name:e.target.value})}/></label>
    <label>{t('ទីតាំង','Location')}<input className="d-input" required maxLength={500} placeholder={t('អាសយដ្ឋាន ឬទីសម្គាល់','Address or landmark')} value={draft.location} onChange={e=>update({location:e.target.value})}/></label>
    <p className="access-helper">{t('រយៈទទឹង និងរយៈបណ្ដោយគឺស្រេចចិត្ត។ បញ្ចូលទាំងពីរ ឬទុកទទេទាំងពីរ។','Coordinates are optional. Enter both or leave both blank.')}</p>
    <div className="access-site-coordinates"><label>{t('រយៈទទឹង','Latitude')}<input className="d-input" type="number" inputMode="decimal" step="any" min={-90} max={90} value={draft.latitude??''} onChange={e=>update({latitude:e.target.value===''?null:Number(e.target.value)})}/></label><label>{t('រយៈបណ្ដោយ','Longitude')}<input className="d-input" type="number" inputMode="decimal" step="any" min={-180} max={180} value={draft.longitude??''} onChange={e=>update({longitude:e.target.value===''?null:Number(e.target.value)})}/></label></div>
    <button type="button" className="d-btn d-btn-outline access-btn secondary" disabled={busy||locating} onClick={useCurrentLocation}><LocateFixed size={18}/>{locating?t('កំពុងរកទីតាំង…','Getting location…'):t('ប្រើទីតាំងបច្ចុប្បន្នរបស់ខ្ញុំ','Use my current location')}</button>
    {locationMessage&&<p className={locationError?'access-error':'access-helper'} role={locationError?'alert':'status'}>{locationMessage}</p>}
   </section>
   <CollapsibleSiteSection title={t('ថ្ងៃ និងម៉ោងធ្វើការ','Working days & hours')} icon={<Clock size={18}/>} optional={t('ស្រេចចិត្ត','Optional')}>
    <div className="access-hours-mode" role="group" aria-label={t('របៀបកំណត់ម៉ោង','Schedule mode')}>
     <button type="button" className={`d-btn ${hoursMode==='same'?'d-btn-primary':'d-btn-ghost'}`} aria-pressed={hoursMode==='same'} disabled={busy} onClick={useSameHours}>{t('ម៉ោងដូចគ្នារាល់ថ្ងៃ','Same hours every day')}</button>
     <button type="button" className={`d-btn ${hoursMode==='different'?'d-btn-primary':'d-btn-ghost'}`} aria-pressed={hoursMode==='different'} disabled={busy} onClick={()=>setHoursMode('different')}>{t('ម៉ោងខុសគ្នាតាមថ្ងៃ','Different hours by day')}</button>
    </div>
    <p className="access-helper">{hoursMode==='same'?t('ម៉ោងនេះអនុវត្តពីថ្ងៃចន្ទដល់ថ្ងៃអាទិត្យ។','These hours apply Monday through Sunday.'):t('ជ្រើសថ្ងៃដែលបើក និងកំណត់ម៉ោងសម្រាប់ថ្ងៃនីមួយៗ។','Select operating days and set hours for each day.')} {t('ម៉ោងបិទមុនម៉ោងបើកមានន័យថាបិទថ្ងៃបន្ទាប់។','A closing time before opening means the next day.')}</p>
    {hoursMode==='same'?<div className="access-site-coordinates access-shared-hours">
     <label>{t('បើក','Opening')}<input className="d-input" type="time" required disabled={busy} value={draft.workingHours[0]?.opens??''} onChange={e=>changeSharedHours({opens:e.target.value})}/></label>
     <label>{t('បិទ','Closing')}<input className="d-input" type="time" required disabled={busy} value={draft.workingHours[0]?.closes??''} onChange={e=>changeSharedHours({closes:e.target.value})}/></label>
    </div>:<div className="access-working-days">{days.map((label,day)=>{const hours=draft.workingHours.find(h=>h.day===day);return <div className={`access-working-day ${hours?'enabled':''}`} key={day}><label className="access-day-toggle"><CheckField checked={!!hours} disabled={busy} onChange={e=>update({workingHours:e.target.checked?[...draft.workingHours,{day,opens:'16:00',closes:'22:00'}]:draft.workingHours.filter(h=>h.day!==day)})}/>{label}</label>{hours?<div className="access-day-times"><input className="d-input" type="time" aria-label={`${label} ${t('បើក','opening')}`} required value={hours.opens} onChange={e=>changeHours(day,{opens:e.target.value})}/><span>–</span><input className="d-input" type="time" aria-label={`${label} ${t('បិទ','closing')}`} required value={hours.closes} onChange={e=>changeHours(day,{closes:e.target.value})}/></div>:<small>{t('មិនបានកំណត់','Not set')}</small>}</div>;})}</div>}
   </CollapsibleSiteSection>
   <CollapsibleSiteSection title={t('រយៈពេលប្រតិបត្តិការ','Operating period')} icon={<CalendarDays size={18}/>} ><label>{t('ចាប់ផ្ដើមពី','Running from')}<input className="d-input" type="date" min="1900-01-01" max="9999-12-31" required value={draft.runningFrom} onChange={e=>update({runningFrom:e.target.value})}/></label><label>{t('បិទនៅថ្ងៃ','Shutdown on')}<small>{t('ស្រេចចិត្ត','Optional')}</small><input className="d-input" type="date" min={draft.runningFrom||'1900-01-01'} max="9999-12-31" value={draft.shutdownOn??''} onChange={e=>update({shutdownOn:e.target.value||null})}/></label>{draft.shutdownOn&&draft.shutdownOn<draft.runningFrom&&<p role="alert" className="access-error">{t('ថ្ងៃបិទត្រូវនៅក្រោយថ្ងៃចាប់ផ្ដើម','Shutdown must be on or after the running-from date.')}</p>}
    {!creating&&<label className="access-site-active"><span>{t('ដំណើរការ','Active')}</span><SwitchField checked={draft.active} disabled={busy} onChange={e=>update({active:e.target.checked})}/></label>}
   </CollapsibleSiteSection>
   <section className="access-site-section"><h3><Pencil size={18}/>{t('កំណត់សម្គាល់','Remarks')}<small>{t('ស្រេចចិត្ត','Optional')}</small></h3><textarea className="d-textarea" aria-label={t('កំណត់សម្គាល់','Remarks')} rows={3} maxLength={2000} value={draft.remarks} onChange={e=>update({remarks:e.target.value})}/></section>
   {error&&<div className="d-alert d-alert-error access-error" role="alert">{error}{recovery}</div>}
  </form>
 </AppDialog>;
}

function CollapsibleSiteSection({title,icon,optional,children}:{title:string;icon:ReactNode;optional?:string;children:ReactNode}){
 const [expanded,setExpanded]=useState(false);const id=useId();
 return <section className="access-site-section access-site-collapsible"><h3><button type="button" className="access-site-section-trigger" aria-label={title} aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(value=>!value)}>{icon}<span>{title}{optional&&<small>{optional}</small>}</span><ChevronDown size={18} className="access-site-section-chevron"/></button></h3><div id={id} className="access-site-section-body" hidden={!expanded}>{children}</div></section>;
}

export function SiteDetails({site,onClose}:{site:AccessSite;onClose:()=>void}){
 const {t,lang}=useLanguage();const days=lang==='km'?['អាទិត្យ','ចន្ទ','អង្គារ','ពុធ','ព្រហស្បតិ៍','សុក្រ','សៅរ៍']:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
 return <AppDialog title={t('ព័ត៌មានសាខា','Site details')} onClose={onClose}><div className="access-user-detail"><h3>{site.name}</h3><dl>{[[t('ទីតាំង','Location'),site.location],[t('រយៈទទឹង','Latitude'),site.latitude],[t('រយៈបណ្ដោយ','Longitude'),site.longitude],[t('ចាប់ផ្ដើមពី','Running from'),site.runningFrom],[t('បិទនៅ','Shutdown on'),site.shutdownOn],[t('កំណត់សម្គាល់','Remarks'),site.remarks]].map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{value??'—'}</dd></div>)}</dl>{site.workingHours?.length?<section><h3>{t('ថ្ងៃ និងម៉ោងធ្វើការ','Working days & hours')}</h3>{site.workingHours.map(hours=><p key={hours.day}>{days[hours.day]} · {hours.opens}–{hours.closes}</p>)}</section>:null}</div></AppDialog>;
}
