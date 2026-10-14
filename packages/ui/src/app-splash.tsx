import mascot from '../../../resources/mascots/01-hello-bite.svg';
import wordmark from '../../../resources/brand/one-bite-wordmark-orange.svg';

/** Animated mascot launch screen. Its lifetime follows real app initialization, never a fixed delay. */
export function AppSplash({appName,message}:{appName:string;message:string}){
 return <main className="ob-app-splash" data-app={appName.toLowerCase()} aria-busy="true">
  <div className="ob-splash-content">
   <div className="ob-splash-brand" aria-hidden="true"><div className="ob-splash-stamp"><img src={mascot} alt=""/></div><img className="ob-splash-wordmark" src={wordmark} alt=""/><span className="ob-splash-app-name">{appName}</span></div>
   <div className="ob-splash-status" role="status" aria-live="polite"><span className="ob-sr-only">OneBite — {appName}. </span><p>{message}</p><span className="ob-splash-dots" aria-hidden="true"><i/><i/><i/></span></div>
  </div>
 </main>;
}
