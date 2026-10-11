import {useCallback,useEffect,useRef,useState} from 'react';
import {emptyWorkspace,type PosWorkspace} from '@onebite/core/pos';
import {loadPosWorkspace,savePosWorkspace} from '@onebite/offline/pos';
/** Serialize edits and publish only after durable SQLite persistence succeeds. */
export function useWorkspace(actor:string|undefined,site:number|undefined){
 const [workspace,setWorkspace]=useState<PosWorkspace|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const value=useRef<PosWorkspace|null>(null),generation=useRef(0),queue=useRef(Promise.resolve());
 useEffect(()=>{const current=++generation.current;value.current=null;setWorkspace(null);setError('');if(actor===undefined||site===undefined)return;
  void loadPosWorkspace(actor,site).then(data=>{if(current!==generation.current)return;value.current=data??emptyWorkspace(site);setWorkspace(value.current);}).catch(()=>{if(current===generation.current)setError('storage_failed');});return()=>{generation.current++;};
 },[actor,site]);
 const update=useCallback((change:(current:PosWorkspace)=>PosWorkspace)=>{
  const current=generation.current;
  const next=queue.current.then(async()=>{if(current!==generation.current||!value.current||actor===undefined||site===undefined)return;setBusy(true);setError('');try{const changed=change(value.current);const saved=await savePosWorkspace(actor,site,changed);if(current===generation.current){value.current=saved;setWorkspace(saved);}}catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'storage_failed');throw e;}finally{if(current===generation.current)setBusy(false);}});
  queue.current=next.catch(()=>{});return next;
 },[actor,site]);
 return {workspace,busy,error,update};
}
