import type { ReactNode } from 'react';

/** Avatar may be a shared UserAvatar or an app-specific authorized photo loader. */
export function IdentitySummary({name,detail,avatar,className='access-editor-person'}:{name:string;detail:ReactNode;avatar:ReactNode;className?:string}){
 return <div className={`ob-identity-summary ${className}`}>{avatar}<div><strong>{name}</strong><small>{detail}</small></div></div>;
}
