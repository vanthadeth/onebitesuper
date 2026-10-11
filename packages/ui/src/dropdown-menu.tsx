import {createContext,useContext,useState,type ComponentProps,type ReactNode} from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';

const DismissContext=createContext<{open:boolean;dismiss:()=>void}|null>(null);
export function DropdownRoot({children}:{children:ReactNode}){
 const [open,setOpen]=useState(false);
 return <DismissContext.Provider value={{open,dismiss:()=>setOpen(false)}}><Menu.Root open={open} onOpenChange={setOpen}>{children}</Menu.Root></DismissContext.Provider>;
}
export function DropdownContent(props:ComponentProps<typeof Menu.Content>){
 const state=useContext(DismissContext);
 if(!state?.open)return null;
 return <Menu.Portal><div style={{display:'contents'}}>
  {/* Keep the backdrop mounted until click, so the complete pointer gesture is consumed. */}
  <div className="ob-dropdown-backdrop" aria-hidden="true" onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.preventDefault();event.stopPropagation();state.dismiss();}}/>
  <Menu.Content {...props} style={{...props.style,zIndex:201}} onPointerDownOutside={event=>event.preventDefault()}/>
 </div></Menu.Portal>;
}
