import { useEffect } from 'react';

type Feedback = 'selection' | 'success' | 'error';
const patterns: Record<Feedback, number | number[]> = {
 selection: 10,
 success: [12, 40, 18],
 error: [25, 45, 25],
};
let lastFeedback = -Infinity;

/** Touch feedback is optional and never interrupts an action. */
export function haptic(kind: Feedback = 'selection') {
 if(typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function')return;
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const now=performance.now();
 if(kind==='selection' && now-lastFeedback<80)return;
 lastFeedback=now;
 try{navigator.vibrate(patterns[kind]);}catch{/* Unsupported or blocked by the device. */}
}

/** One shared listener covers buttons and portalled Radix controls in both apps. */
export function InteractionFeedback() {
 useEffect(()=>{
  const clicked=(event:MouseEvent)=>{
   if(!(event.target instanceof Element))return;
   const control=event.target.closest<HTMLElement>('button,[role="menuitem"],[role="menuitemradio"],[role="option"]');
   if(!control || control.closest('[inert]') || control.matches(':disabled,[aria-disabled="true"],[data-disabled]'))return;
   if(control.getAttribute('role')==='menuitemradio' && control.dataset.state==='checked')return;
   haptic();
  };
  // Capture before React changes the selected state; disabled controls are ignored.
  document.addEventListener('click',clicked,true);
  return()=>document.removeEventListener('click',clicked,true);
 },[]);
 return null;
}
