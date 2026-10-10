import { useEffect, useRef, useState, type ReactNode } from "react";

export function PageHeading({ title, subtitle, action }: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  const [compact,setCompact]=useState(false);
  const headingRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const element=headingRef.current, parent=element?.parentElement;
    if(!element||!parent)return;
    const measure=()=>parent.style.setProperty('--ob-page-heading-height',`${element.getBoundingClientRect().height}px`);
    measure();const observer=new ResizeObserver(measure);observer.observe(element);
    return()=>{observer.disconnect();parent.style.removeProperty('--ob-page-heading-height');};
  },[]);
  useEffect(()=>{
    let frame=0;
    const update=()=>{frame=0;const y=Math.max(0,window.scrollY);setCompact(previous=>previous?y>4:y>24);};
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
    update();window.addEventListener('scroll',scroll,{passive:true});
    return()=>{window.removeEventListener('scroll',scroll);cancelAnimationFrame(frame);};
  },[]);
  return <header ref={headingRef} className={`ob-page-heading ${compact?'is-compact':''}`}>
    <div className="ob-page-heading-copy"><h1>{title}</h1><p aria-hidden={compact}>{subtitle}</p></div>
    {action && <div className="ob-page-heading-action">{action}</div>}
  </header>;
}
