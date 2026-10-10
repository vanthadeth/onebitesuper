import {useState} from 'react';
import {ProfilePage,ProfilePhotoEditor,InlineError,useLanguage} from '@onebite/ui';
import {accessApi,ApiError,readSession} from '@onebite/accounts';
import type {Account} from '@onebite/core/access';
import {prepareCatalogPhoto} from './photo';

type Props={account:Account;photo?:string;canEditCatalog:boolean;dark:boolean;live:boolean;busy:boolean;token:string;adminUrl:string;onLanguage:()=>void;onTheme:()=>void;onSignOut:()=>void;onRefresh:()=>Promise<void>};
export function InventoryProfile({account,photo,canEditCatalog,dark,live,busy,token,adminUrl,onLanguage,onTheme,onSignOut,onRefresh}:Props){
 const {t}=useLanguage(),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 async function save(image:string|null){
  if(!live||busy||saving||readSession()!==token)throw new Error('unauthorized');
  setSaving(true);setError('');
  try{
   const authorization=await accessApi('me',{},token);
   if(readSession()!==token||authorization.offline||authorization.actor?.id!==account.id||authorization.mfaRequired||authorization.mustChangePin||!Number.isSafeInteger(authorization.state?.revision))throw new Error('unauthorized');
   let photoPath:string|null=null;
   if(image){const reply=await accessApi('profile.photo.upload',{image:image.split(',')[1]},token);if(!reply.photoPath)throw new ApiError('photo_upload_failed',502);photoPath=reply.photoPath;}
   if(readSession()!==token)throw new Error('unauthorized');
   await accessApi('profile.photo.update',{id:account.id,photoPath,revision:authorization.state!.revision},token);
   if(readSession()!==token)return false;
   await onRefresh();return true;
  }catch{setError(t('មិនអាចរក្សាទុករូបថតបាន។ សូមព្យាយាមម្ដងទៀត។','Could not save the photo. Please try again.'));return false;}finally{setSaving(false);}
 }
 return <>
  {error&&!editing&&<InlineError message={error}/>}
  <ProfilePage app="Inventory" account={account} roleName={account.role} photo={photo} canEditCatalog={canEditCatalog} accountUrl={account.role==='Owner'?adminUrl:undefined} dark={dark} live={live} busy={busy||saving} onLanguage={onLanguage} onTheme={onTheme} onSignOut={onSignOut} onPhoto={()=>{setError('');setEditing(true);}}/>
  {editing&&live&&<ProfilePhotoEditor photo={photo} hasPhoto={!!account.photoPath} busy={busy||saving} error={error} preparePhoto={prepareCatalogPhoto} onClose={()=>{setEditing(false);setError('');}} onSave={save}/>}
 </>;
}
