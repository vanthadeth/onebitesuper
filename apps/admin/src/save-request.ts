import { accessApi, ApiError, type Snapshot, type AccessReply } from './access-api';

type Request = typeof accessApi;
function unchangedTarget(action:string,payload:Record<string,unknown>,before:Snapshot,after:Snapshot) {
 if(action==='user.create'||action==='role.create'||action==='site.create')return true; // Server still checks usernames and permissions.
 if(action==='permissions.update'){
  const role=payload.role as keyof Snapshot['grants'];
  return JSON.stringify([...(before.grants[role]||[])].sort())===JSON.stringify([...(after.grants[role]||[])].sort());
 }
 if(action==='site.update'){
  const original=before.sites.find(site=>site.id===payload.id),latest=after.sites.find(site=>site.id===payload.id);
  return Boolean(original&&latest)&&JSON.stringify(original)===JSON.stringify(latest);
 }
 if(action==='pin.reset')return false; // Never automatically repeat a credential change.
 const original=before.users.find(user=>user.id===payload.id),latest=after.users.find(user=>user.id===payload.id);
 const normalize=(user:typeof original)=>user?{...user,sites:[...user.sites].sort((a,b)=>a-b)}:null;
 return Boolean(original&&latest)&&JSON.stringify(normalize(original))===JSON.stringify(normalize(latest));
}

// A global revision can advance because an unrelated record changed. Refresh
// once and retry only when the edited record still matches the original snapshot.
export async function saveRequest(action:string,payload:Record<string,unknown>,snapshot:Snapshot,session:string,request:Request=accessApi):Promise<AccessReply> {
 try{return await request(action,{...payload,revision:snapshot.revision},session);}
 catch(error){
  if(!(error instanceof ApiError)||error.code!=='stale_revision')throw error;
  const latest=await request('me',{},session);
  if(!latest.state||latest.mustChangePin||!unchangedTarget(action,payload,snapshot,latest.state))throw error;
  return request(action,{...payload,revision:latest.state.revision},session);
 }
}
