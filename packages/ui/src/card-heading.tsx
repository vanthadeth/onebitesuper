import type { ReactNode } from 'react';

/** A card's icon, heading, supporting text and optional trailing action/badge. */
export function CardHeading({title,id,description,icon,action,className='',iconClassName='',copyClassName=''}:{title:string;id?:string;description?:ReactNode;icon:ReactNode;action?:ReactNode;className?:string;iconClassName?:string;copyClassName?:string}){
 return <header className={`ob-card-heading ${className}`}><span className={iconClassName}>{icon}</span><div className={copyClassName}><h2 id={id}>{title}</h2>{description&&<p>{description}</p>}</div>{action}</header>;
}
