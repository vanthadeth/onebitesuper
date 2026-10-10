import { useEffect, useState, type ReactNode } from "react";

export function PageHeading({ title, subtitle, action }: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  const [compact,setCompact]=useState(false);
  useEffect(()=>{
    let frame=0;
    const update=()=>{frame=0;const y=Math.max(0,window.scrollY);setCompact(previous=>previous?y>4:y>24);};
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
    update();window.addEventListener('scroll',scroll,{passive:true});
    return()=>{window.removeEventListener('scroll',scroll);cancelAnimationFrame(frame);};
  },[]);
  return <header className={`ob-page-heading ${compact?'is-compact':''}`}>
    <div className="ob-page-heading-copy"><h1>{title}</h1><p aria-hidden={compact}>{subtitle}</p></div>
    {action && <div className="ob-page-heading-action">{action}</div>}
  </header>;
}
