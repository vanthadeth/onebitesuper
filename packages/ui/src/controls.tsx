import { Children, isValidElement, useId, useState, type ReactNode, type ReactElement, type ComponentProps } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';

// Native inputs retain mobile keyboards and password-manager support. Menus,
// check controls and dialogs use Radix primitives rather than browser widgets.
type Option = {value:string|number; children:ReactNode; disabled?:boolean};
export function SelectField({value,onChange,children,className='',placeholder,...props}:{value:string|number;onChange:(event:{target:{value:string}})=>void;children:ReactNode;className?:string;placeholder?:string;disabled?:boolean;'aria-label'?:string;id?:string}) {
 const options=Children.toArray(children).filter(isValidElement).map(child=>(child as ReactElement<Option>).props);
 return <Select.Root value={String(value)} onValueChange={value=>onChange({target:{value}})} disabled={props.disabled}>
  <Select.Trigger {...props} className={`ob-select ${className}`}><Select.Value placeholder={placeholder}/><Select.Icon><ChevronDown size={16}/></Select.Icon></Select.Trigger>
  <Select.Portal><Select.Content className="ob-select-menu" position="popper" sideOffset={6} collisionPadding={12}><Select.ScrollUpButton className="ob-select-scroll"><ChevronUp size={16}/></Select.ScrollUpButton><Select.Viewport>{options.map(option=><Select.Item key={option.value} value={String(option.value)} data-value={String(option.value)} disabled={option.disabled} className="ob-select-option"><Select.ItemText>{option.children}</Select.ItemText><Select.ItemIndicator><Check size={16}/></Select.ItemIndicator></Select.Item>)}</Select.Viewport><Select.ScrollDownButton className="ob-select-scroll"><ChevronDown size={16}/></Select.ScrollDownButton></Select.Content></Select.Portal>
 </Select.Root>;
}
export function CheckField({checked,onChange,className='',...props}:Omit<ComponentProps<typeof Checkbox.Root>,'checked'|'onCheckedChange'|'onChange'> & {checked:boolean;onChange:(event:{target:{checked:boolean}})=>void}) {
 const id=useId();
 return <Checkbox.Root {...props} id={props.id||id} checked={checked} onCheckedChange={checked=>onChange({target:{checked:checked===true}})} className={`ob-check ${className}`}><Checkbox.Indicator><Check size={13} strokeWidth={3}/></Checkbox.Indicator></Checkbox.Root>;
}
export function AppDialog({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
 const [opener]=useState(()=>document.activeElement instanceof HTMLElement?document.activeElement:null);
 return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal><Dialog.Overlay className="ob-dialog-overlay"/><Dialog.Content className={`modal ob-dialog ${wide?'wide':''}`} aria-describedby={undefined} onCloseAutoFocus={event=>{event.preventDefault();if(opener?.isConnected)opener.focus();}}><div className="modal-inner"><header className="modal-heading"><Dialog.Title>{title}</Dialog.Title><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></header>{children}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
