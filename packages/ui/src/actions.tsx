import type { ComponentProps, ReactNode } from 'react';
import { Plus } from 'lucide-react';

/** Icon on mobile, icon and label on larger screens. Authorization stays with the caller. */
export function NewAction({label,visibleLabel=label,icon=<Plus size={22}/>,className='',...props}:Omit<ComponentProps<'button'>,'children'|'aria-label'|'title'|'type'> & {label:string;visibleLabel?:string;icon?:ReactNode}){
 return <button {...props} type="button" className={`d-btn d-btn-primary access-btn access-create-user ${className}`} aria-label={label} title={label}>{icon}<span className="access-new-label">{visibleLabel}</span></button>;
}
