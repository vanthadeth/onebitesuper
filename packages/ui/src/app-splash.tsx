import icon from '../../../resources/brand/one-bite-icon-white.svg';
import wordmark from '../../../resources/brand/one-bite-wordmark-orange.svg';

/** Brand-stamp launch screen. Its lifetime follows real app initialization, never a fixed delay. */
export function AppSplash({appName,message}:{appName:string;message:string}){
 return <main className="ob-app-splash" aria-busy="true">
  <div className="ob-splash-content">
   <div className="ob-splash-brand" aria-hidden="true"><div className="ob-splash-stamp"><img src={icon} alt=""/></div><img className="ob-splash-wordmark" src={wordmark} alt=""/><span className="ob-splash-app-name">{appName}</span></div>
   <div className="ob-splash-status" role="status" aria-live="polite"><span className="ob-sr-only">OneBite — {appName}. </span><p>{message}</p><span className="ob-splash-dots" aria-hidden="true"><i/><i/><i/></span></div>
  </div>
 </main>;
}
