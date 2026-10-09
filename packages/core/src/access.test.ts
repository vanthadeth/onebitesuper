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
 const n=saveAccount(s,"owner",{...s.users[0],id:"owner2",username:"owner.two"},true);assert.equal(saveAccount(n,"owner",{...n.users[0],active:false}).users[0].active,false);
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
