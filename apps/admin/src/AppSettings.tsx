import {useEffect,useId,useState,type ReactNode} from 'react';
import {MapPin,SlidersHorizontal,Check,Globe2,Banknote,Settings,LocateFixed,Languages,Moon,Sun,Wallet,QrCode,Clock3} from 'lucide-react';
import {AppDialog,SelectField,useLanguage} from '@onebite/ui';
import {appSettingsOrDefault,validAppSettings,type AppSettings} from '@onebite/core/app-settings';
import './settings-bento.css';

export function AppSettingsEditor({settings,busy,error,recovery,onSave}:{settings?:AppSettings;busy:boolean;error:string;recovery?:ReactNode;onSave:(settings:AppSettings)=>Promise<boolean>}){
 const {t}=useLanguage();const initial=appSettingsOrDefault(settings);const [draft,setDraft]=useState(initial),[baseline,setBaseline]=useState(initial);const id=useId();const dirty=JSON.stringify(draft)!==JSON.stringify(baseline);
 useEffect(()=>{if(!dirty){const latest=appSettingsOrDefault(settings);setDraft(latest);setBaseline(latest);}},[settings,dirty]);
 const [editing,setEditing]=useState<string|null>(null),[failed,setFailed]=useState(false),[saving,setSaving]=useState(false);
 const begin=(section:string)=>{setDraft({...baseline});setFailed(false);setEditing(section);};
 const editor={busy,saving,dirty,valid:validAppSettings(draft),error:failed?error:'',recovery,onClose:()=>{if(!saving){setDraft({...baseline});setEditing(null);setFailed(false);}},onSubmit:async()=>{if(busy||!dirty||!validAppSettings(draft))return;setSaving(true);try{const saved=await onSave(draft);if(saved){setBaseline({...draft});setEditing(null);}else setFailed(true);}finally{setSaving(false);}}};
 const update=(patch:Partial<AppSettings>)=>setDraft(old=>({...old,...patch}));
 const number=(value:number)=>value.toLocaleString('en-US');
 return <div className="access-settings-form">
  <div className="access-settings-grid">
   <SettingsSection editor={editor} open={editing==='geofence'} onOpen={()=>begin('geofence')} className="settings-geofence" title={t('ព្រំដែនទីតាំង','Geofence')} description={t('ទីតាំងសម្រាប់ចូល និងចេញការងារ។','Location rules for check-in and check-out.')} icon={<MapPin size={21}/>} summary={<>
    <div className="settings-radius"><span className="settings-radius-ring" aria-hidden="true"/><span className="settings-radius-ring inner" aria-hidden="true"/><span className="settings-radius-pin"><MapPin size={22}/></span><strong>{number(baseline.geofenceRadiusM)} <span>m</span></strong><small>{t('ចម្ងាយពីសាខា','Distance from site')}</small></div>
    <div className="settings-accuracy"><LocateFixed size={19}/><span>{t('ភាពមិនច្បាស់លាស់ GPS','GPS uncertainty')}<strong>≤ {number(baseline.gpsAccuracyM)} m</strong></span></div>
    <div className="settings-pending"><Clock3 size={15}/>{t('សម្រាប់ម៉ូឌុលវត្តមានខាងមុខ','For upcoming Attendance')}</div>
   </>}>
    <label>{t('ចម្ងាយពីសាខា (ម៉ែត្រ)','Distance from site (m)')}<input className="d-input" type="number" min={1} max={10000} step={1} required disabled={busy} value={draft.geofenceRadiusM||''} onChange={e=>update({geofenceRadiusM:Number(e.target.value)})}/></label>
    <label>{t('កម្រិតភាពមិនច្បាស់លាស់ GPS (ម៉ែត្រ)','Maximum GPS uncertainty (m)')}<input className="d-input" type="number" min={1} max={10000} step={1} required aria-label={t('កម្រិតភាពមិនច្បាស់លាស់ GPS (ម៉ែត្រ)','Maximum GPS uncertainty (m)')} aria-describedby={`${id}-accuracy-help`} disabled={busy} value={draft.gpsAccuracyM||''} onChange={e=>update({gpsAccuracyM:Number(e.target.value)})}/><small id={`${id}-accuracy-help`}>{t('ចំនួនតូចមានភាពត្រឹមត្រូវខ្ពស់ជាង។','A smaller number requires a more accurate location.')}</small></label>
    <div className="d-alert access-settings-note">{t('ច្បាប់នេះនឹងប្រើពេលម៉ូឌុលវត្តមានរួចរាល់។ សាខាត្រូវមានរយៈទទឹង និងរយៈបណ្ដោយ។','These rules will apply when Attendance is available. Sites need latitude and longitude.')}</div>
   </SettingsSection>
   <SettingsSection editor={editor} open={editing==='preferences'} onOpen={()=>begin('preferences')} className="settings-preferences" title={t('ចំណូលចិត្ត','Preferences')} description={t('លំនាំដើមសម្រាប់កម្មវិធី OneBite។','Defaults for OneBite apps.')} icon={<SlidersHorizontal size={21}/>} summary={<dl className="settings-defaults">
    <PreferenceSummary icon={<Languages size={19}/>} label={t('ភាសា','Language')} value={baseline.defaultLanguage==='km'?'ខ្មែរ':'English'}/>
    <PreferenceSummary icon={baseline.defaultTheme==='dark'?<Moon size={19}/>:<Sun size={19}/>} label={t('រូបរាង','Appearance')} value={baseline.defaultTheme==='dark'?t('ងងឹត','Dark'):t('ភ្លឺ','Light')}/>
    <PreferenceSummary icon={<Banknote size={19}/>} label={t('រូបិយប័ណ្ណ','Currency')} value={baseline.defaultCurrency}/>
    <PreferenceSummary icon={baseline.defaultPaymentMethod==='cash'?<Wallet size={19}/>:<QrCode size={19}/>} label={t('ការទូទាត់','Payment')} value={baseline.defaultPaymentMethod==='cash'?t('សាច់ប្រាក់','Cash'):t('ការទូទាត់ QR','QR Payment')}/>
   </dl>}>
    <div className="settings-preference-fields">
     <label>{t('ភាសាលំនាំដើម','Default language')}<SelectField aria-label={t('ភាសាលំនាំដើម','Default language')} disabled={busy} value={draft.defaultLanguage} onChange={e=>update({defaultLanguage:e.target.value as AppSettings['defaultLanguage']})}><option value="km">ខ្មែរ</option><option value="en">English</option></SelectField></label>
     <label>{t('រូបរាងលំនាំដើម','Default theme')}<SelectField aria-label={t('រូបរាងលំនាំដើម','Default theme')} disabled={busy} value={draft.defaultTheme} onChange={e=>update({defaultTheme:e.target.value as AppSettings['defaultTheme']})}><option value="light">{t('ភ្លឺ','Light')}</option><option value="dark">{t('ងងឹត','Dark')}</option></SelectField></label>
     <label>{t('រូបិយប័ណ្ណលំនាំដើម','Default currency')}<SelectField aria-label={t('រូបិយប័ណ្ណលំនាំដើម','Default currency')} disabled={busy} value={draft.defaultCurrency} onChange={e=>update({defaultCurrency:e.target.value as AppSettings['defaultCurrency']})}><option value="KHR">KHR · {t('រៀល','Cambodian riel')}</option><option value="USD">USD · {t('ដុល្លារ','US dollar')}</option></SelectField></label>
     <label>{t('វិធីទូទាត់លំនាំដើម','Default payment method')}<SelectField aria-label={t('វិធីទូទាត់លំនាំដើម','Default payment method')} disabled={busy} value={draft.defaultPaymentMethod} onChange={e=>update({defaultPaymentMethod:e.target.value as AppSettings['defaultPaymentMethod']})}><option value="cash">{t('សាច់ប្រាក់','Cash')}</option><option value="qr">{t('ការទូទាត់ QR','QR Payment')}</option></SelectField></label>
    </div><small>{t('ភាសា និងរូបរាងដែលអ្នកជ្រើសផ្ទាល់ មានអាទិភាពលើលំនាំដើម។','Individual language and theme choices override these defaults.')}</small>
   </SettingsSection>
   <SettingsSection editor={editor} open={editing==='exchange'} onOpen={()=>begin('exchange')} className="settings-exchange" title={t('អត្រាប្ដូរប្រាក់','Exchange rate')} description={t('បម្លែងតម្លៃពីរៀលទៅដុល្លារ។','Convert prices from KHR to USD.')} icon={<Banknote size={21}/>} summary={<div className="settings-rate"><span>1 USD</span><span className="settings-rate-equals" aria-hidden="true">=</span><strong>{number(baseline.exchangeRate)} <span>KHR</span></strong></div>}>
    <label>{t('ចំនួន KHR សម្រាប់ USD 1','KHR for USD 1')}<input className="d-input" type="number" required min={1} max={1000000} step={1} disabled={busy} value={draft.exchangeRate||''} onChange={e=>update({exchangeRate:Number(e.target.value)})}/></label><small className="settings-rounding"><Globe2 size={16}/>{t('តម្លៃ និងការបង្គត់ត្រូវបានគណនាជា KHR។','Prices and rounding are calculated in KHR.')}</small>
   </SettingsSection>
  </div>
 </div>;
}

function PreferenceSummary({icon,label,value}:{icon:ReactNode;label:string;value:string}){
 return <div><span className="settings-default-icon">{icon}</span><div><dt>{label}</dt><dd>{value}</dd></div></div>;
}
type SettingsPopup = {busy:boolean;saving:boolean;dirty:boolean;valid:boolean;error:string;recovery?:ReactNode;onClose:()=>void;onSubmit:()=>Promise<void>};
function SettingsSection({className,title,description,icon,summary,children,open,onOpen,editor}:{className:string;title:string;description:string;icon:ReactNode;summary:ReactNode;children:ReactNode;open:boolean;onOpen:()=>void;editor:SettingsPopup}){
 const {t}=useLanguage();const id=useId();
 return <section className={`d-card access-settings-card ${className}`} aria-labelledby={`${id}-title`}>
  <h2 id={`${id}-title`}><button type="button" className="access-settings-trigger" aria-label={title} aria-haspopup="dialog" disabled={editor.busy} onClick={onOpen}><span className="settings-card-icon">{icon}</span><span className="settings-card-heading"><strong>{title}</strong><small>{description}</small></span><Settings className="access-settings-edit" size={19}/></button></h2>
  <div className="settings-card-summary">{summary}</div>
  {open&&<AppDialog title={title} wide={className==='settings-preferences'} onClose={editor.onClose} footer={<div className="settings-popup-actions"><button type="button" className="d-btn access-btn secondary" disabled={editor.saving} onClick={editor.onClose}>{t('បោះបង់','Cancel')}</button><button type="submit" form={`${id}-form`} className="d-btn d-btn-primary access-btn" disabled={!editor.dirty||editor.busy||!editor.valid}><Check size={18}/>{editor.busy?t('កំពុងរក្សាទុក…','Saving…'):t('រក្សាទុកការកំណត់','Save settings')}</button></div>}>
   <form id={`${id}-form`} className="access-form settings-popup-fields" onSubmit={event=>{event.preventDefault();void editor.onSubmit();}}>
    <p className="settings-popup-description">{description}</p>{children}
    {editor.error&&<div className="d-alert d-alert-error access-error" role="alert">{editor.error}{editor.recovery}</div>}
   </form>
  </AppDialog>}
 </section>;
}
