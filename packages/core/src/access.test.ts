import test from "node:test";
import assert from "node:assert/strict";
import {initialAccessState,saveAccount,assignSites,saveGrants,can,visibleAccounts,AccessError} from "./access.ts";
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
test("permissions cannot exceed role ceilings or alter the protected Owner grant set",()=>{
 const s=initialAccessState();assert.throws(()=>saveGrants(s,"owner","Cashier",["users.manage"]),error("permission_ceiling"));
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
