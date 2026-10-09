export const roles = ["Cashier", "Supervisor", "Owner"] as const;
export type Role = (typeof roles)[number];
export type Account = {
  id: string;
  name: string;
  username: string;
  role: Role;
  sites: number[];
  active: boolean;
};
export const moduleDefinitions = [
  { id: "pos.access", group: "POS", km: "ប្រព័ន្ធលក់", en: "POS" },
  { id: "attendance.access", group: "Attendance", km: "វត្តមាន", en: "Attendance" },
  { id: "inventory.access", group: "Inventory", km: "ស្តុក", en: "Inventory" },
  { id: "admin.access", group: "Admin", km: "រដ្ឋបាល", en: "Admin" },
] as const;
export const permissionDefinitions = [
  ...moduleDefinitions,
  { id: "orders.create", group: "POS", km: "ទទួលការបញ្ជាទិញ", en: "Receive orders" },
  { id: "orders.discount", group: "POS", km: "បញ្ចុះតម្លៃក្នុងកម្រិត", en: "Apply allowed discounts" },
  { id: "orders.complimentary", group: "POS", km: "ផ្ដល់មុខម្ហូបឥតគិតថ្លៃ", en: "Use complimentary allowance" },
  { id: "orders.cancel_unpaid", group: "POS", km: "បោះបង់វិក្កយបត្រមិនទាន់បង់", en: "Cancel unpaid invoices" },
  { id: "orders.qr_reference", group: "POS", km: "បន្ថែមរូបយោង QR", en: "Attach QR references" },
  { id: "shifts.manage", group: "POS", km: "បើកវេន និងផ្ទេរប្រាក់", en: "Open shifts and hand over cash" },
  { id: "cash.withdraw", group: "POS", km: "ដក ឬប្រមូលប្រាក់", en: "Withdraw or collect cash" },
  { id: "staff.assign", group: "Admin", km: "ចាត់បុគ្គលិកទៅសាខា", en: "Assign existing staff to sites" },
  { id: "users.manage", group: "Admin", km: "គ្រប់គ្រងគណនីបុគ្គលិក", en: "Manage user accounts" },
  { id: "roles.manage", group: "Admin", km: "គ្រប់គ្រងតួនាទី និងសិទ្ធិ", en: "Manage role permissions" },
  { id: "sites.manage", group: "Admin", km: "គ្រប់គ្រងសាខា", en: "Manage sites" },
  { id: "catalog.manage", group: "Admin", km: "គ្រប់គ្រងមុខម្ហូប និងតម្លៃ", en: "Manage items and prices" },
  { id: "rules.manage", group: "Admin", km: "កំណត់ច្បាប់បញ្ចុះតម្លៃ", en: "Configure promotions and exchange rate" },
  { id: "orders.override", group: "Never", km: "រំលងកម្រិតបញ្ចុះតម្លៃ", en: "Override discount limits" },
  { id: "orders.refund", group: "Never", km: "សងប្រាក់ ឬបោះបង់វិក្កយបត្របង់រួច", en: "Refund or cancel paid invoices" },
] as const;
export type Permission = (typeof permissionDefinitions)[number]["id"];
export type Grants = Record<Role, Permission[]>;
export type AccessSite = { id: number; name: string; active: boolean };
export type AccessEvent = { id: string; time: string; actorId: string; actorName: string; action: string; targetName: string; detail: string };
export type AccessState = { version: 1; users: Account[]; sites: AccessSite[]; grants: Grants; events: AccessEvent[] };
const posPermissions: Permission[] = ["orders.create", "orders.discount", "orders.complimentary", "orders.cancel_unpaid", "orders.qr_reference", "shifts.manage"];
export const ceilings: Grants = {
  Cashier: ["pos.access", "attendance.access", "admin.access", ...posPermissions],
  Supervisor: ["pos.access", "attendance.access", "inventory.access", "admin.access", ...posPermissions, "cash.withdraw", "staff.assign"],
  Owner: permissionDefinitions.filter(p=>p.group !== "Never").map(p=>p.id),
};
export function hasPermission(grants: Permission[], role: Role, permission: Permission): boolean {
  const definition = permissionDefinitions.find(p=>p.id===permission);
  if(!definition || definition.group==="Never" || !ceilings[role].includes(permission) || !grants.includes(permission)) return false;
  const module = moduleDefinitions.find(m=>m.group===definition.group);
  return Boolean(module && grants.includes(module.id) && ceilings[role].includes(module.id));
}
export function defaultGrants(): Grants { return structuredClone(ceilings); }
export class AccessError extends Error {
  code: "forbidden" | "invalid_name" | "invalid_username" | "duplicate_username" | "invalid_site" | "site_required" | "last_owner" | "not_found" | "invalid_role" | "immutable_grant" | "permission_ceiling";
  constructor(code: AccessError["code"]) { super(code); this.code=code; }
}
export function getActor(state: AccessState, id: string): Account {
  const actor = state.users.find(u=>u.id===id&&u.active);
  if(!actor) throw new AccessError("forbidden");
  return actor;
}
export function can(state: AccessState, actor: Account, permission: Permission, site?: number): boolean {
  // Actor permissions come from current persisted account, not a caller-supplied role.
  const current = state.users.find(u=>u.id===actor.id&&u.active);
  if(!current || !ceilings[current.role].includes(permission) || !state.grants[current.role].includes(permission)) return false;
  if(!hasPermission(state.grants[current.role], current.role, permission)) return false;
  if(site===undefined) return true;
  return state.sites.some(s=>s.id===site&&s.active) && (current.role==="Owner"||current.sites.includes(site));
}
function event(state: AccessState, actor: Account, action: string, target: string, detail: string): AccessEvent[] {
  return [...state.events, {id: crypto.randomUUID(),time:new Date().toISOString(),actorId:actor.id,actorName:actor.name,action,targetName:target,detail}].slice(-200);
}
function normalize(account: Account, sites: AccessSite[], allowUnassigned = false): Account {
  if(!roles.includes(account.role))throw new AccessError("invalid_role");
  const name=account.name.trim(),username=account.username.trim().toLowerCase();
  if(!name || name.length>100)throw new AccessError("invalid_name");
  if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username))throw new AccessError("invalid_username");
  const assigned=[...new Set(account.sites)].sort((a,b)=>a-b);
  if(assigned.some(id=>!sites.some(s=>s.id===id)))throw new AccessError("invalid_site");
  if(account.active&&account.role!=="Owner"&&!(allowUnassigned&&assigned.length===0)&&!assigned.some(id=>sites.some(s=>s.id===id&&s.active)))throw new AccessError("site_required");
  return {...account,name,username,sites:assigned};
}
export function saveAccount(state: AccessState, actorId: string, account: Account, creating = false): AccessState {
  const actor=getActor(state,actorId);
  if(!can(state,actor,"users.manage"))throw new AccessError("forbidden");
  const existing=state.users.find(u=>u.id===account.id);
  if(creating ? Boolean(existing) : !existing)throw new AccessError("not_found");
  if(creating&&account.role==="Owner")throw new AccessError("invalid_role");
  const next=normalize(creating?{...account,active:true,sites:[]}:account,state.sites,creating||existing?.sites.length===0);
  if(state.users.some(u=>u.id!==next.id&&u.username.toLowerCase()===next.username))throw new AccessError("duplicate_username");
  const users=creating?[...state.users,next]:state.users.map(u=>u.id===next.id?next:u);
  if(!users.some(u=>u.active&&u.role==="Owner"))throw new AccessError("last_owner");
  return {...state,users,events:event(state,actor,creating?"user.created":"user.updated",next.name,`${next.role} · ${next.active?"active":"inactive"} · sites ${next.sites.join(", ")||"all (Owner)"}`)};
}
export function assignSites(state: AccessState, actorId: string, accountId: string, siteIds: number[]): AccessState {
  const actor=getActor(state,actorId),target=state.users.find(u=>u.id===accountId);
  if(!target)throw new AccessError("not_found");
  if(!can(state,actor,"staff.assign"))throw new AccessError("forbidden");
  if(actor.role!=="Owner"&&(target.role!=="Cashier"||!target.sites.some(id=>can(state,actor,"staff.assign",id))))throw new AccessError("forbidden");
  const sites=[...new Set(siteIds)].sort((a,b)=>a-b);
  if(sites.some(id=>!state.sites.some(s=>s.id===id)))throw new AccessError("invalid_site");
  if(actor.role!=="Owner"){
    const outsideBefore=target.sites.filter(id=>!actor.sites.includes(id));
    const outsideAfter=sites.filter(id=>!actor.sites.includes(id));
    if(outsideBefore.length!==outsideAfter.length||outsideBefore.some(id=>!outsideAfter.includes(id)))throw new AccessError("forbidden");
    const changed=[...new Set([...target.sites,...sites])].filter(id=>target.sites.includes(id)!==sites.includes(id));
    if(changed.some(id=>!can(state,actor,"staff.assign",id)))throw new AccessError("forbidden");
  }
  const next=normalize({...target,sites},state.sites);
  return {...state,users:state.users.map(u=>u.id===target.id?next:u),events:event(state,actor,"sites.assigned",target.name,sites.map(id=>state.sites.find(s=>s.id===id)!.name).join(", "))};
}
export function saveGrants(state: AccessState, actorId: string, role: Role, permissions: Permission[]): AccessState {
  const actor=getActor(state,actorId);
  if(!can(state,actor,"roles.manage"))throw new AccessError("forbidden");
  if(!roles.includes(role))throw new AccessError("invalid_role");
  // Owner's role stays fixed to preserve account administration and recovery.
  if(role==="Owner")throw new AccessError("immutable_grant");
  const grants=[...new Set(permissions)];
  if(grants.some(p=>!ceilings[role].includes(p)))throw new AccessError("permission_ceiling");
  return {...state,grants:{...state.grants,[role]:grants},events:event(state,actor,"permissions.updated",role,grants.join(", "))};
}
export function visibleAccounts(state: AccessState, actor: Account): Account[] {
  if(can(state,actor,"users.manage"))return state.users;
  if(can(state,actor,"staff.assign"))return state.users.filter(u=>u.id===actor.id||(u.role==="Cashier"&&u.sites.some(id=>actor.sites.includes(id))));
  return state.users.filter(u=>u.id===actor.id);
}
export function initialAccessState(): AccessState {
  return {version:1,sites:[{id:0,name:"Riverside",active:true},{id:1,name:"Neighborhood",active:true},{id:2,name:"Street corner",active:true}],grants:defaultGrants(),events:[],users:[
    {id:"owner",name:"Dara",username:"dara",role:"Owner",sites:[],active:true},
    {id:"supervisor",name:"Vannak",username:"vannak",role:"Supervisor",sites:[0,1],active:true},
    {id:"sokha",name:"Sokha",username:"sokha",role:"Cashier",sites:[0],active:true},
    {id:"srey",name:"Sreypov",username:"sreypov",role:"Cashier",sites:[0,2],active:true},
    {id:"chan",name:"Chantha",username:"chantha",role:"Cashier",sites:[1],active:true},
    {id:"pisey",name:"Pisey",username:"pisey",role:"Cashier",sites:[2],active:true},
  ]};
}
