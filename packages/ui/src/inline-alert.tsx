import type { ReactNode } from 'react';

/** No empty live region; supports a recovery action without owning request state. */
export function InlineError({message,recovery}:{message?:string;recovery?:ReactNode}){
 return message?<div className="d-alert d-alert-error ob-inline-error access-error" role="alert">{message}{recovery}</div>:null;
}
