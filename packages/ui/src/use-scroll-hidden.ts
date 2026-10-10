import {useEffect,useState} from 'react';
/** Hide mobile navigation on downward scroll; keep the page's reserved space. */
export function useScrollHidden(page:string){
 const [hidden,setHidden]=useState(false);
 useEffect(()=>{
  const mobile=window.matchMedia('(max-width:680px)');let anchor=Math.max(0,window.scrollY),frame=0;setHidden(false);
  const update=()=>{frame=0;const position=Math.max(0,window.scrollY);if(!mobile.matches||position<=16){setHidden(false);anchor=position;return;}const delta=position-anchor;if(Math.abs(delta)>=8){setHidden(delta>0);anchor=position;}};
  const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);},resize=()=>{anchor=Math.max(0,window.scrollY);setHidden(false);};
  window.addEventListener('scroll',scroll,{passive:true});mobile.addEventListener('change',resize);
  return()=>{window.removeEventListener('scroll',scroll);mobile.removeEventListener('change',resize);cancelAnimationFrame(frame);};
 },[page]);
 return hidden;
}
