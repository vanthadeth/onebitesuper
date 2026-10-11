import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {Minus,Plus,Package,Pencil,Trash2,ChevronDown} from 'lucide-react';
import {useLanguage} from '@onebite/ui';
import type {DraftLine} from '@onebite/core/pos';
export function CartLine({line,photo,disabled,onQuantity,onRemove,onEdit}:{line:DraftLine;photo?:string;disabled:boolean;onQuantity:(quantity:number)=>void;onRemove:()=>void;onEdit:()=>void}){
 const {t,lang}=useLanguage();const [expanded,setExpanded]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),start=useRef({x:0,y:0}),pressed=useRef(false);
 const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};
 useEffect(()=>clear,[]);
 function down(event:PointerEvent){if(disabled||event.button!==0||Boolean((event.target as HTMLElement).closest('button:not(.pos-line-toggle)')))return;clear();pressed.current=false;start.current={x:event.clientX,y:event.clientY};timer.current=setTimeout(()=>{pressed.current=true;onEdit();clear();},550);}
 const name=lang==='en'&&line.item.nameEn?line.item.nameEn:line.item.name;
 return <li onClick={event=>{if((event.target as HTMLElement).closest('button'))return;if(pressed.current){pressed.current=false;return;}setExpanded(value=>!value);}} onPointerDown={down} onPointerUp={clear} onPointerCancel={clear} onPointerLeave={clear} onPointerMove={event=>{if(Math.hypot(event.clientX-start.current.x,event.clientY-start.current.y)>8)clear();}}>
  <div className="pos-line-photo">{photo?<img src={photo} alt=""/>:<Package size={22}/>}</div>
  <div className="pos-line-details"><button className="pos-line-toggle" aria-label={`${t('ការគណនា','Calculation')} ${name}`} aria-expanded={expanded} onClick={()=>{if(pressed.current){pressed.current=false;return;}setExpanded(value=>!value);}} onContextMenu={event=>{event.preventDefault();clear();if(!disabled)onEdit();}}>
   <span className="pos-line-heading"><strong>{name}</strong><strong className="pos-line-total">{((line.item.priceKhr??0)*line.quantity).toLocaleString()}៛</strong></span><span className="pos-line-description">{line.note||line.item.description||`${line.quantity} × ${line.item.unit}`}<ChevronDown size={12}/></span>
  </button>
  <div className="pos-line-actions"><output aria-label={`${t('ចំនួន','Quantity')} ${line.item.name}`}>{line.quantity}</output><div className="pos-quantity"><button className="d-btn d-btn-ghost" aria-label={`${t('បន្ថយ','Decrease')} ${line.item.name}`} disabled={disabled||line.quantity===1} onClick={()=>onQuantity(line.quantity-1)}><Minus size={15}/></button><button className="d-btn d-btn-ghost" aria-label={`${t('បន្ថែម','Increase')} ${line.item.name}`} disabled={disabled||line.quantity>=999} onClick={()=>onQuantity(line.quantity+1)}><Plus size={15}/></button></div></div>
  {expanded&&<div className="pos-line-calculation"><span>{line.quantity} × {(line.item.priceKhr??0).toLocaleString()}៛ = {((line.item.priceKhr??0)*line.quantity).toLocaleString()}៛</span><div><button className="d-btn d-btn-ghost d-btn-square" aria-label={`${t('កែប្រែ','Edit')} ${name}`} disabled={disabled} onClick={onEdit}><Pencil size={16}/></button><button className="d-btn d-btn-ghost d-btn-square" aria-label={`${t('លុប','Remove')} ${name}`} disabled={disabled} onClick={onRemove}><Trash2 size={16}/></button></div></div>}
  </div>
 </li>;
}
