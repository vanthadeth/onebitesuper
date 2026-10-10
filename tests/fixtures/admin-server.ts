import type {Page} from '@playwright/test';
import {initialAccessState} from './access';
import {saveAccount,assignSites,saveGrants,createRole,saveSite,saveAppSettings,type AccessState} from '../../packages/core/src/access';
const sessions=new WeakMap<Page,{actorId:string}>();
export async function mockAdminServer(page:Page,initial?:AccessState){
 let state={...(initial||initialAccessState()),customRoles:initial?.customRoles||[],revision:0};const session={actorId:'owner'};sessions.set(page,session);
 await page.route('**/functions/v1/admin-access',async route=>{
  const {action,payload}=route.request().postDataJSON();
  try{
   if(action==='bootstrap.status')return route.fulfill({json:{ownerCreated:true}});
   if(action==='logout')return route.fulfill({json:{ok:true}});
   const changes:Record<string,()=>AccessState>={
    'user.create':()=>saveAccount(state,session.actorId,payload,true),'user.update':()=>saveAccount(state,session.actorId,payload),
    'sites.assign':()=>assignSites(state,session.actorId,payload.id,payload.sites),
    'permissions.update':()=>saveGrants(state,session.actorId,payload.role,payload.permissions),
    'role.create':()=>createRole(state,session.actorId,payload,payload.permissions),
    'site.create':()=>saveSite(state,session.actorId,payload,true),'site.update':()=>saveSite(state,session.actorId,payload),
    'settings.update':()=>{const {revision,...settings}=payload;return saveAppSettings(state,session.actorId,settings);},
   };
   if(changes[action])state={...changes[action](),revision:state.revision+1};
   if(action==='activity.list')return route.fulfill({json:{events:[...state.events].reverse(),nextCursor:null}});
   if(action==='site.photo.upload')return route.fulfill({json:{photoPath:'11111111-1111-4111-8111-111111111111/'+crypto.randomUUID()+'.jpg'}});
   return route.fulfill({json:{actor:state.users.find(u=>u.id===session.actorId),state,...(action==='login'?{session:'a'.repeat(64)}:{})}});
  }catch(error){return route.fulfill({status:400,json:{error:(error as Error).message}});}
 });
 await page.route('**/storage/v1/object/public/site-photos/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=','base64')}));
}
export async function switchTestActor(page:Page,actorId:string){const session=sessions.get(page);if(!session)throw Error('No test server');session.actorId=actorId;await page.reload();}
