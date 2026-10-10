import {initialAccessState} from "../../../tests/fixtures/access.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {saveAccount,assignSites,saveGrants,can,visibleAccounts,AccessError,createRole,roleIds,saveSite,siteDraft} from "./access.ts";
const error=(code:string)=>(e:unknown)=>e instanceof AccessError&&e.code===code;
test("usernames are normalized and unique across inactive and active accounts",()=>{
 const s=initialAccessState();const a={...s.users[2],id:"new",name:"  New User  ",username:" New.User ",sites:[1]};
 const n=saveAccount(s,"owner",a,true);assert.equal(n.users.at(-1)!.username,"new.user");assert.equal(n.users.at(-1)!.name,"New User");
 assert.throws(()=>saveAccount(n,"owner",{...a,id:"other",username:"NEW.USER"},true),error("duplicate_username"));
 assert.throws(()=>saveAccount(s,"owner",{...a,username:"x"},true),error("invalid_username"));
});
test("last active Owner and assigned active-site requirement are protected",()=>{
 const s=initialAccessState();assert.throws(()=>saveAccount(s,"owner",{...s.users[0],active:false}),error("last_owner"));
 assert.throws(()=>saveAccount(s,"owner",{...s.users[0],role:"Cashier",sites:[0]}),error("last_owner"));
 assert.throws(()=>saveAccount(s,"owner",{...s.users[2],sites:[]}),error("site_required"));
 const n=saveAccount(s,"owner",{...s.users[2],role:"Owner",sites:[]});assert.equal(saveAccount(n,"owner",{...n.users[0],active:false}).users[0].active,false);
});
test("Supervisor can change managed assignments while preserving outside-site assignments",()=>{
 const s=initialAccessState(),target=s.users.find(u=>u.id==="srey")!;
 const n=assignSites(s,"supervisor",target.id,[1,2]);assert.deepEqual(n.users.find(u=>u.id===target.id)!.sites,[1,2]);
 assert.throws(()=>assignSites(s,"supervisor",target.id,[0,1]),error("forbidden"));
 assert.throws(()=>assignSites(s,"supervisor","pisey",[0,2]),error("forbidden"));
 assert.throws(()=>assignSites(s,"supervisor","owner",[0]),error("forbidden"));
 assert.throws(()=>saveAccount(s,"supervisor",{...target,role:"Owner"}),error("forbidden"));
});
test("Owners configure available permissions while protecting recovery and business rules",()=>{
 const s=initialAccessState();const expanded=saveGrants(s,"owner","Cashier",["admin.access","users.manage"]);assert.equal(can(expanded,expanded.users[2],"users.manage"),true);assert.throws(()=>saveGrants(s,"owner","Cashier",["catalog.manage"]),error("permission_ceiling"));
 assert.throws(()=>saveGrants(s,"owner","Owner",[]),error("immutable_grant"));
 const n=saveGrants(s,"owner","Supervisor",[]);assert.throws(()=>assignSites(n,"supervisor","srey",[0,1,2]),error("forbidden"));
 for(const u of s.users){assert.equal(can(s,u,"orders.override"),false);assert.equal(can(s,u,"orders.refund"),false);}
});
test("current persisted identity controls authorization; inactive accounts have no access",()=>{
 const s=initialAccessState();assert.equal(can(s,{...s.users[2],role:"Owner"},"users.manage"),false);
 const n={...s,users:s.users.map(u=>u.id==="supervisor"?{...u,active:false}:u)};
 assert.equal(can(n,s.users[1],"staff.assign"),false);assert.throws(()=>assignSites(n,"supervisor","srey",[0,1,2]),error("forbidden"));
 assert.deepEqual(visibleAccounts(s,s.users.find(u=>u.id==="sokha")!).map(u=>u.id),["sokha"]);
 assert.ok(!visibleAccounts(s,s.users[1]).some(u=>u.id==="pisey"));
});
test("accepted changes leave the previous snapshot untouched and identify the actor",()=>{
 const s=initialAccessState();const n=saveAccount(s,"owner",{...s.users[2],name:"Updated"});
 assert.equal(s.users[2].name,"Sokha");assert.equal(s.events.length,0);assert.equal(n.events[0].actorId,"owner");assert.equal(n.events[0].action,"user.updated");
});
test("module denial blocks actions, retains grants and restores access when enabled",()=>{
 const s=initialAccessState(),staff=s.users[1];
 const n=saveGrants(s,"owner","Supervisor",s.grants.Supervisor.filter(p=>p!=="admin.access"&&p!=="pos.access"));
 assert.ok(n.grants.Supervisor.includes("staff.assign"));
 assert.ok(n.grants.Supervisor.includes("orders.create"));
 assert.equal(can(n,staff,"staff.assign"),false);assert.equal(can(n,staff,"orders.create",0),false);
 assert.deepEqual(visibleAccounts(n,staff).map(u=>u.id),[staff.id]);
 assert.throws(()=>assignSites(n,staff.id,"sokha",[1]),error("forbidden"));
 const restored=saveGrants(n,"owner","Supervisor",[...n.grants.Supervisor,"admin.access","pos.access"]);
 assert.equal(can(restored,staff,"staff.assign",0),true);assert.equal(can(restored,staff,"orders.create",0),true);
 const actionDenied=saveGrants(s,"owner","Supervisor",s.grants.Supervisor.filter(p=>p!=="staff.assign"));
 assert.equal(can(actionDenied,staff,"admin.access"),true);assert.equal(can(actionDenied,staff,"staff.assign"),false);
 assert.equal(can(s,s.users[2],"inventory.access"),false);
});

test("new staff defaults active and unassigned, rejects Owner creation and keeps site operations scoped",()=>{
 const s=initialAccessState();const staff={...s.users[2],id:"new-staff",username:"new.staff",active:false,sites:[1]};
 const n=saveAccount(s,"owner",staff,true);const created=n.users.at(-1)!;
 assert.equal(created.active,true);assert.deepEqual(created.sites,[]);assert.equal(can(n,created,"orders.create",0),false);
 const renamed=saveAccount(n,"owner",{...created,name:"Updated Staff"});assert.equal(renamed.users.at(-1)!.name,"Updated Staff");
 const assigned=assignSites(renamed,"owner",created.id,[0]);assert.equal(can(assigned,created,"orders.create",0),true);
 assert.throws(()=>saveAccount(s,"owner",{...staff,role:"Owner"},true),error("invalid_role"));
});

test("custom roles persist grants, reject duplicates and unknown roles, and retain site scope",()=>{
 const s=initialAccessState(),role={id:"role_"+crypto.randomUUID(),name:"Shift Lead",description:"Help the team"};
 const n=createRole(s,"owner",role,["admin.access","users.manage","pos.access","orders.create"]);assert.ok(roleIds(n).includes(role.id));assert.equal(s.customRoles,undefined);
 assert.throws(()=>createRole(n,"owner",{...role,id:"role_"+crypto.randomUUID(),name:" shift lead "},[]),error("duplicate_role"));assert.throws(()=>createRole(s,"sokha",role,[]),error("forbidden"));assert.throws(()=>createRole(s,"owner",role,["orders.refund"]),error("permission_ceiling"));
 const assigned=saveAccount(n,"owner",{...n.users[2],role:role.id});assert.equal(can(assigned,assigned.users[2],"users.manage"),true);assert.equal(can(assigned,assigned.users[2],"orders.create",1),false);assert.equal(can(assigned,assigned.users[2],"orders.create",0),true);
 assert.throws(()=>saveAccount(assigned,"sokha",{...assigned.users[0],name:"Hijacked"}),error("forbidden"));assert.throws(()=>saveAccount(n,"owner",{...n.users[2],role:"missing"}),error("invalid_role"));
 const ownerChanged=saveGrants(n,"owner","Owner",n.grants.Owner.filter(p=>p!=="orders.discount"));assert.equal(can(ownerChanged,ownerChanged.users[0],"orders.discount"),false);assert.equal(can(ownerChanged,ownerChanged.users[0],"roles.manage"),true);
});

test("site creation defaults active, validates operating details, and preserves assignments on edits",()=>{
 const s=initialAccessState(),draft={...siteDraft(),name:" Test Site ",location:" Phnom Penh ",latitude:11.5,longitude:104.9,active:false};
 const n=saveSite(s,"owner",draft,true),created=n.sites.at(-1)!;
 const withoutCoordinates=saveSite(s,"owner",{...draft,name:"Without coordinates",latitude:null,longitude:null},true);assert.equal(withoutCoordinates.sites.at(-1)!.latitude,null);
 assert.throws(()=>saveSite(s,"owner",{...draft,longitude:null},true),error("invalid_coordinates"));
 assert.equal(created.name,"Test Site");assert.equal(created.active,true);assert.equal(created.location,"Phnom Penh");assert.equal(n.events.at(-1)!.action,"site.created");assert.equal(s.sites.length,3);
 assert.throws(()=>saveSite(n,"owner",{...draft,name:"test site"},true),error("duplicate_site"));
 assert.throws(()=>saveSite(n,"owner",{...draft,latitude:91},true),error("invalid_coordinates"));
 assert.throws(()=>saveSite(n,"owner",{...draft,runningFrom:"2026-02-30"},true),error("invalid_dates"));
 assert.throws(()=>saveSite(n,"owner",{...draft,runningFrom:"2026-10-09",shutdownOn:"2026-10-08"},true),error("invalid_dates"));
 assert.throws(()=>saveSite(n,"owner",{...draft,workingHours:[{day:0,opens:"16:00",closes:"16:00"}]},true),error("invalid_hours"));
 assert.throws(()=>saveSite(n,"sokha",draft,true),error("forbidden"));
 const grants=saveGrants(n,"owner","Cashier",[...n.grants.Cashier,"sites.manage"]);
 const updated=saveSite(grants,"sokha",{...siteDraft(grants.sites[0]),location:"Existing location",latitude:0,longitude:0,active:false});
 assert.deepEqual(updated.users,grants.users);assert.equal(updated.sites[0].active,false);assert.equal(can(updated,updated.users[2],"orders.create",0),false);
 const denied=saveGrants(updated,"owner","Cashier",updated.grants.Cashier.filter(p=>p!=="admin.access"));
 assert.throws(()=>saveSite(denied,"sokha",draft,true),error("forbidden"));
});

test('app settings validate defaults, enforce permissions, and record accepted changes',async()=>{
 const {saveAppSettings}=await import('./access.ts');const {defaultAppSettings,validAppSettings}=await import('./app-settings.ts');const s=initialAccessState();const updated={...defaultAppSettings,exchangeRate:4100,gpsAccuracyM:20};const n=saveAppSettings(s,'owner',updated);assert.equal(n.appSettings!.exchangeRate,4100);assert.equal(n.events.at(-1)!.action,'settings.updated');assert.equal(s.appSettings,undefined);assert.throws(()=>saveAppSettings(s,'supervisor',updated),error('forbidden'));assert.throws(()=>saveAppSettings(s,'owner',{...updated,geofenceRadiusM:0}),error('invalid_settings'));assert.equal(validAppSettings({...updated,defaultLanguage:null}),false);assert.equal(validAppSettings({...updated,exchangeRate:4100.5}),false);assert.equal(validAppSettings({...updated,secret:'never stored'}),false);const delegated=saveGrants(s,'owner','Supervisor',[...s.grants.Supervisor,'settings.manage']);assert.equal(saveAppSettings(delegated,'supervisor',updated).appSettings!.gpsAccuracyM,20);
});
test('delegated role management cannot escalate or create stronger roles',()=>{
 const s=saveGrants(initialAccessState(),'owner','Supervisor',['admin.access','roles.manage']);
 assert.throws(()=>saveGrants(s,'supervisor','Supervisor',['admin.access','roles.manage','users.manage']),error('forbidden'));
 assert.throws(()=>createRole(s,'supervisor',{id:'role_11111111-1111-4111-8111-111111111111',name:'Powerful',description:''},['admin.access','users.manage']),error('forbidden'));
});
test('delegated account administration cannot assign or take over a privileged role',()=>{
 const s=saveGrants(initialAccessState(),'owner','Cashier',['admin.access','users.manage']);const actor=s.users.find(u=>u.role==='Cashier')!;
 assert.throws(()=>saveAccount(s,actor.id,{...s.users.find(u=>u.id==='supervisor')!}),error('forbidden'));
 assert.throws(()=>saveAccount(s,actor.id,{...actor,role:'Supervisor'}),error('forbidden'));
});
