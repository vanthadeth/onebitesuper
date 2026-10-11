import {useEffect,useRef} from 'react';
import {Package,Plus} from 'lucide-react';
import {useLanguage} from '@onebite/ui';
import type {CatalogItem} from '@onebite/core/inventory';
export function MenuProduct({item,photo,disabled,onAdd,onSettings}:{item:CatalogItem;photo?:string;disabled:boolean;onAdd:()=>void;onSettings:()=>void}){
 const {lang}=useLanguage(),timer=useRef<ReturnType<typeof setTimeout>|null>(null),start=useRef({x:0,y:0}),pressed=useRef(false);
 const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};useEffect(()=>clear,[]);
 return <button className="d-card pos-product" disabled={disabled} onClick={()=>{if(pressed.current){pressed.current=false;return;}onAdd();}} onContextMenu={event=>{event.preventDefault();clear();if(!disabled)onSettings();}} onKeyDown={event=>{if(event.key==='F2'||event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){event.preventDefault();clear();if(!disabled)onSettings();}}} onPointerDown={event=>{if(disabled||event.button!==0)return;clear();pressed.current=false;start.current={x:event.clientX,y:event.clientY};timer.current=setTimeout(()=>{pressed.current=true;clear();onSettings();},550);}} onPointerUp={clear} onPointerCancel={clear} onPointerLeave={clear} onPointerMove={event=>{if(Math.hypot(event.clientX-start.current.x,event.clientY-start.current.y)>8)clear();}}>
  <div className="pos-product-image">{photo?<img src={photo} alt="" loading="lazy"/>:<Package size={40}/>}</div><div className="pos-product-copy"><strong>{lang==='en'&&item.nameEn?item.nameEn:item.name}</strong><div className="pos-product-price"><span>{(item.priceKhr??0).toLocaleString()}៛</span><span className="pos-product-plus"><Plus size={20}/></span></div></div>
 </button>;
}
