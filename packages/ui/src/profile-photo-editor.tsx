import {useRef,useState} from 'react';
import {Camera,Check,Trash2} from 'lucide-react';
import {AppDialog} from './controls';
import {useLanguage} from './shared';
export function ProfilePhotoEditor({photo,hasPhoto,busy,error,onClose,onSave,preparePhoto}:{preparePhoto:(file:File)=>Promise<string>;photo?:string;hasPhoto:boolean;busy:boolean;error:string;onClose:()=>void;onSave:(image:string|null)=>Promise<boolean>}){
 const {t}=useLanguage(),input=useRef<HTMLInputElement>(null);
 const [preview,setPreview]=useState(photo),[draft,setDraft]=useState<string|null|undefined>(),[working,setWorking]=useState(false),[problem,setProblem]=useState('');
 const disabled=busy||working;
 async function select(file:File){setWorking(true);setProblem('');try{const image=await preparePhoto(file);setDraft(image);setPreview(image);}catch{setProblem(t('សូមជ្រើសរើសរូប JPEG, PNG ឬ WebP ដែលមានទំហំមិនលើស 15 MB។','Choose a JPEG, PNG or WebP image up to 15 MB.'));}finally{setWorking(false);}}
 async function save(){if(draft===undefined||disabled)return;setWorking(true);setProblem('');try{if(await onSave(draft))onClose();}catch{setProblem(t('មិនអាចផ្ទុករូបបាន។ សូមព្យាយាមម្ដងទៀត។','Could not upload the photo. Please try again.'));}finally{setWorking(false);}}
 return <AppDialog title={t('រូបថតគណនី','Profile photo')} onClose={()=>{if(!disabled)onClose();}} footer={<div className="profile-photo-footer"><button type="button" className="d-btn d-btn-outline" disabled={disabled} onClick={onClose}>{t('បោះបង់','Cancel')}</button><button type="button" className="d-btn d-btn-primary" disabled={disabled||draft===undefined} onClick={()=>void save()}><Check size={18}/>{disabled?t('កំពុងដំណើរការ…','Working…'):t('រក្សាទុករូបថត','Save photo')}</button></div>}>
  <div className="profile-photo-editor"><div className="profile-photo-preview">{preview?<img src={preview} alt={t('មើលរូបថតជាមុន','Photo preview')}/>:<Camera size={42}/>}</div><p>{t('រូបថតនេះបង្ហាញនៅលើប្រវត្តិរូប និងម៉ឺនុយគណនីរបស់អ្នក។','This photo appears on your profile and account menu.')}</p>
   <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="ob-sr-only" aria-label={t('ជ្រើសរើសរូបថតគណនី','Choose profile photo')} disabled={disabled} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void select(file);}}/>
   <button type="button" className="d-btn d-btn-primary" disabled={disabled} onClick={()=>input.current?.click()}><Camera size={18}/>{preview?t('ប្ដូររូបថត','Replace photo'):t('បញ្ចូលរូបថត','Upload photo')}</button>
   {(preview||hasPhoto)&&<button type="button" className="d-btn d-btn-ghost" disabled={disabled} onClick={()=>{setDraft(null);setPreview(undefined);setProblem('');}}><Trash2 size={17}/>{t('លុបរូបថត','Remove photo')}</button>}
   <small>JPEG, PNG, WebP · {t('អតិបរមា 15 MB','Up to 15 MB')}</small>
   {(problem||error)&&<div className="d-alert d-alert-error" role="alert">{problem||error}</div>}
  </div>
 </AppDialog>;
}
