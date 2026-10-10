import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { UserAvatar, ProfilePhotoEditor as PhotoEditor } from '@onebite/ui';
import type { Account } from '@onebite/core/access';
import { accessApi } from './access-api';
import { prepareSitePhoto } from './site-photo';

// Private images are fetched through the session-checked API, never public URLs.
export function useProfilePhoto(path:string|null|undefined,session:string,online:boolean,id?:string){
 const cache=useContext(UserPhotos)?.cache;
 const [photo,setPhoto]=useState<{path:string;session:string;id?:string;image:string}|null>(null);
 useEffect(()=>{
  let active=true;
  if(path&&session&&online){
   const key=JSON.stringify([session,id,path]);
   let request=cache?.get(key);
   if(!request){request=accessApi('profile.photo.read',id?{id}:{},session).then(reply=>reply.photo??undefined);cache?.set(key,request);void request.catch(()=>cache?.delete(key));}
   void request.then(image=>{if(active&&image&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))setPhoto({path,session,id,image});}).catch(()=>{});
  }
  return()=>{active=false;};
 },[path,session,online,id,cache]);
 return photo&&photo.path===path&&photo.session===session&&photo.id===id?photo.image:undefined;
}

const UserPhotos=createContext<{users:Account[];session:string;online:boolean;actorId:string;ownPhoto?:string;cache:Map<string,Promise<string|undefined>>}|null>(null);
export function UserPhotoProvider({children,...value}:{children:ReactNode;users:Account[];session:string;online:boolean;actorId:string;ownPhoto?:string}){
 const scope=useRef({session:value.session,cache:new Map<string,Promise<string|undefined>>()});
 if(scope.current.session!==value.session)scope.current={session:value.session,cache:new Map()};
 return <UserPhotos.Provider value={{...value,cache:scope.current.cache}}>{children}</UserPhotos.Provider>;
}
export function AccountAvatar({id,name,className='access-avatar'}:{id:string;name:string;className?:string}){
 const context=useContext(UserPhotos),account=context?.users.find(user=>user.id===id),self=id===context?.actorId;
 const fetched=useProfilePhoto(account?.photoPath,context?.session||'',!!context?.online&&!self,id);
 return <UserAvatar name={name} photo={self?context?.ownPhoto:fetched} className={className} lazy/>;
}

export function ProfilePhotoEditor(props:Omit<Parameters<typeof PhotoEditor>[0],"preparePhoto">){return <PhotoEditor {...props} preparePhoto={prepareSitePhoto}/>;}
