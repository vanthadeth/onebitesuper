import { useLayoutEffect, useRef, type ReactNode } from "react";

export function PageHeading({ title, subtitle, action }: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  const heading=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    const element=heading.current,parent=element?.parentElement;if(!element||!parent)return;
    const measure=()=>parent.style.setProperty('--ob-page-heading-height',`${element.getBoundingClientRect().height}px`);
    measure();const observer=new ResizeObserver(measure);observer.observe(element);
    return()=>{observer.disconnect();parent.style.removeProperty('--ob-page-heading-height');};
  },[]);
  return <header ref={heading} className="ob-page-heading">
    <div className="ob-page-heading-copy"><h1>{title}</h1><p>{subtitle}</p></div>
    {action && <div className="ob-page-heading-action">{action}</div>}
  </header>;
}
