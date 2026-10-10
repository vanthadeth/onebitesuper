import { useState } from 'react';

/** Decorative avatar: the adjacent account name supplies the accessible label. */
export function UserAvatar({name,photo,className='access-avatar',lazy=false}:{name:string;photo?:string;className?:string;lazy?:boolean}){
 const [failed,setFailed]=useState<string>();
 return <span className={`ob-user-avatar ${className}`} aria-hidden="true">{photo&&failed!==photo?<img src={photo} alt="" loading={lazy?'lazy':'eager'} onError={()=>setFailed(photo)}/>:Array.from(name.trim())[0]||'?'}</span>;
}
