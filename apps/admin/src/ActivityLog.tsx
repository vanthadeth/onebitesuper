import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, History, LoaderCircle, RefreshCw } from 'lucide-react';
import { EmptyState, useLanguage } from '@onebite/ui';
import type { AccessEvent } from '@onebite/core/access';
import { accessApi, ApiError } from './access-api';
type CreateAction=Parameters<typeof EmptyState>[0]['action'];
const zone='Asia/Phnom_Penh';
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
export function eventDay(time:string){return dayFormatter.format(new Date(time));}
export function ActivityLog({events,live,session,revision,createAction,onUnauthorized}:{events:AccessEvent[];live:boolean;session:string;revision:number;createAction?:CreateAction;onUnauthorized:(error:unknown)=>void}){
 const {t}=useLanguage();
 const [start,setStart]=useState(''),[end,setEnd]=useState(''),[range,setRange]=useState({start:'',end:''});
 const invalid=Boolean(start&&end&&start>end);
 return <div className="access-activity-page">
  <form className="access-activity-filters d-card" onSubmit={e=>{e.preventDefault();if(!invalid)setRange({start,end});}}>
   <label><span><CalendarDays size={16}/>{t('ពីថ្ងៃ','From date')}</span><input type="date" value={start} max={end||undefined} onChange={e=>setStart(e.target.value)}/></label>
   <label><span>{t('ដល់ថ្ងៃ','To date')}</span><input type="date" value={end} min={start||undefined} onChange={e=>setEnd(e.target.value)}/></label>
   <button className="access-btn" disabled={invalid}>{t('បង្ហាញប្រវត្តិ','Show logs')}</button>
   {(start||end||range.start||range.end)&&<button type="button" className="access-text" onClick={()=>{setStart('');setEnd('');setRange({start:'',end:''});}}>{t('កំណត់ឡើងវិញ','Clear dates')}</button>}
   <small>{t('កាលបរិច្ឆេទតាមម៉ោងកម្ពុជា។','Dates use Cambodia time.')}</small>
   {invalid&&<p role="alert" className="access-error">{t('ថ្ងៃបញ្ចប់ត្រូវនៅក្រោយថ្ងៃចាប់ផ្ដើម។','To date must be on or after From date.')}</p>}
  </form>
  <ActivityFeed key={`${range.start}:${range.end}:${revision}`} events={events} live={live} session={session} range={range} createAction={createAction} onUnauthorized={onUnauthorized}/>
 </div>;
}
function ActivityFeed({events,live,session,range,createAction,onUnauthorized}:{events:AccessEvent[];live:boolean;session:string;range:{start:string;end:string};createAction?:CreateAction;onUnauthorized:(error:unknown)=>void}){
 const {t,lang}=useLanguage();
 const [items,setItems]=useState<AccessEvent[]>([]),[more,setMore]=useState(true),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
 const sentinel=useRef<HTMLDivElement>(null),cursor=useRef<{time:string;id:string}|null>(null),offset=useRef(0),inFlight=useRef(false),generation=useRef(0);
 const load=useCallback(async()=>{
  if(inFlight.current)return;inFlight.current=true;setLoading(true);setFailed(false);const epoch=generation.current;
  try{
   let page:AccessEvent[],hasMore:boolean;
   if(live){const reply=await accessApi('activity.list',{...range,cursor:cursor.current},session);if(!reply.events)throw new Error('invalid_response');page=reply.events;hasMore=Boolean(reply.nextCursor);cursor.current=reply.nextCursor??null;}
   else{const filtered=[...events].filter(e=>{const day=eventDay(e.time);return (!range.start||day>=range.start)&&(!range.end||day<=range.end);}).sort((a,b)=>b.time.localeCompare(a.time)||b.id.localeCompare(a.id));page=filtered.slice(offset.current,offset.current+30);offset.current+=page.length;hasMore=offset.current<filtered.length;}
   if(epoch!==generation.current)return;
   setItems(previous=>{const ids=new Set(previous.map(e=>e.id));return [...previous,...page.filter(e=>!ids.has(e.id))];});setMore(hasMore);
  }catch(error){if(epoch!==generation.current)return;setFailed(true);if(error instanceof ApiError&&error.code==='unauthorized')onUnauthorized(error);}
  finally{if(epoch===generation.current){inFlight.current=false;setLoading(false);}}
 },[events,live,session,range,onUnauthorized]);
 // Keep the initial loader stable across parent renders; requests from removed feeds cannot append results.
 const initialLoad=useRef(load);
 useEffect(()=>{inFlight.current=false;void initialLoad.current();return()=>{generation.current++;};},[]);
 useEffect(()=>{if(!more||loading||failed||!sentinel.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void load();},{rootMargin:'240px'});observer.observe(sentinel.current);return()=>observer.disconnect();},[more,loading,failed,load]);
 const groups=new Map<string,AccessEvent[]>();for(const event of items){const day=eventDay(event.time);groups.set(day,[...(groups.get(day)||[]),event]);}
 const locale=lang==='km'?'km-KH':'en-GB';
 return <div className="access-activity" aria-busy={loading}>
  {[...groups].map(([day,logs])=><section className="access-activity-group" key={day}><h2><time dateTime={day}>{new Intl.DateTimeFormat(locale,{timeZone:zone,dateStyle:'full'}).format(new Date(logs[0].time))}</time><span>{logs.length}</span></h2>{logs.map(e=><article className="access-activity-row" key={e.id}><span className="access-avatar small"><History size={16}/></span><div><strong>{e.targetName}</strong><p>{e.action} · {e.actorName}</p><small>{e.detail}</small></div><time dateTime={e.time}>{new Intl.DateTimeFormat(locale,{timeZone:zone,timeStyle:'short'}).format(new Date(e.time))}</time></article>)}</section>)}
  {!items.length&&!loading&&!failed&&<EmptyState className="access-empty" icon={<History size={30}/>} title={range.start||range.end?t('មិនមានប្រវត្តិក្នុងរយៈពេលនេះ','No logs in this date range'):t('មិនទាន់មានការផ្លាស់ប្ដូរ','No changes yet')} body={range.start||range.end?t('សាកល្បងកាលបរិច្ឆេទផ្សេង។','Try another date range.'):t('ការផ្លាស់ប្ដូរគណនី និងសិទ្ធិនឹងបង្ហាញនៅទីនេះ។','Account and permission changes will appear here.')} action={range.start||range.end?undefined:createAction}/>}
  <div className="access-activity-load" ref={sentinel}>
   {loading?<span role="status"><LoaderCircle size={18} className="access-activity-spinner"/>{t('កំពុងផ្ទុកប្រវត្តិ…','Loading logs…')}</span>:failed?<><p role="alert">{t('មិនអាចផ្ទុកប្រវត្តិបាន។ សូមព្យាយាមម្តងទៀត។','Could not load logs. Please retry.')}</p><button className="access-text" onClick={()=>void load()}><RefreshCw size={16}/>{t('ព្យាយាមម្តងទៀត','Retry')}</button></>:more?<button className="access-text" onClick={()=>void load()}>{t('ផ្ទុកបន្ថែម','Load more')}</button>:items.length?<small>{t('ប្រវត្តិទាំងអស់បានបង្ហាញ','All logs shown')}</small>:null}
  </div>
 </div>;
}
