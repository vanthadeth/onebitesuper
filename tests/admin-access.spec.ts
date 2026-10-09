import { test, expect, type Page } from '@playwright/test';
test.beforeEach(async({page},info)=>{if(!info.title.startsWith('Khmer'))await page.addInitScript(()=>localStorage.setItem('onebite-language','en'));});
async function open(page:Page){await page.route('**/functions/v1/admin-access',route=>route.abort());await page.goto('http://127.0.0.1:5174');await page.getByRole('button',{name:'Open local preview'}).click();}
async function choose(page:Page,label:string,value:string){await page.getByLabel(label,{exact:true}).click();await page.locator(`[role="option"][data-value="${value}"]`).click();}
async function viewUser(page:Page,name:string){await page.locator('.access-user-row').filter({hasText:name}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:'User details',exact:true})).toBeVisible();}
async function editUser(page:Page,name:string){await viewUser(page,name);await page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true}).click();}
async function reviewRole(page:Page,role:string){const row=page.locator('.access-role-row').filter({has:page.getByRole('heading',{name:role,exact:true})});const toggle=row.getByRole('button',{name:role,exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await row.getByRole('button',{name:'Review permissions',exact:true}).click();}
async function tab(page:Page,name:string){await page.getByRole('button',{name,exact:true}).filter({visible:true}).click();}
test('Owner creates and edits accounts, prevents duplicates, preserves changes and audits them',async({page})=>{
 await open(page);await expect(page.locator('.access-user-row')).toHaveCount(6);
 await page.getByRole('button',{name:'Create new user',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Full name').fill('Test Staff');await dialog.getByLabel('Username',{exact:true}).fill('sokha');
 await expect(dialog.getByRole('alert')).toContainText('already used');await expect(dialog.getByRole('button',{name:'Create User',exact:true})).toBeDisabled();
 await dialog.getByLabel('Username',{exact:true}).fill('test.staff');await choose(page,'Role','Cashier');await dialog.getByRole('button',{name:'Create User',exact:true}).click();
 await expect(page.locator('.access-user-row')).toHaveCount(7);await page.reload();await page.getByRole('button',{name:'Open local preview'}).click();
 await editUser(page,'Test Staff');await dialog.getByLabel('Account active',{exact:true}).uncheck();await dialog.getByRole('button',{name:'Save changes'}).click();
 await expect(page.locator('.access-user-row')).toHaveCount(6);await page.reload();await page.getByRole('button',{name:'Open local preview'}).click();await expect(page.locator('.access-user-row')).toHaveCount(6);await expect(page.locator('.access-user-row').filter({hasText:'Test Staff'})).toHaveCount(0);
 await choose(page,'Filter status','inactive');await expect(page.locator('.access-user-row')).toHaveCount(1);await expect(page.locator('.access-user-row')).toContainText('Test Staff');
 await page.getByRole('textbox',{name:'Search users',exact:true}).fill('no-such-user');await page.locator('.ob-empty-state').getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.locator('.access-user-row')).toHaveCount(6);await expect(page.locator('.access-user-row').filter({hasText:'Test Staff'})).toHaveCount(0);
 await tab(page,'Activity');await expect(page.locator('.access-activity')).toContainText('Test Staff');await expect(page.locator('.access-activity')).toContainText('Dara');
});
test('Protects the last Owner and keeps unavailable permissions disabled',async({page})=>{
 await open(page);await editUser(page,'Dara');const dialog=page.getByRole('dialog');
 await expect(dialog.getByLabel('Role',{exact:true})).toBeDisabled();await expect(dialog.getByLabel('Account active',{exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await tab(page,'Roles');await reviewRole(page,'Cashier');
 await expect(dialog.getByLabel('Manage user accounts')).toBeEnabled();await expect(dialog.getByLabel('Override discount limits')).toBeDisabled();await expect(dialog.getByLabel('Refund or cancel paid invoices')).toBeDisabled();
 await dialog.getByLabel('Apply allowed discounts').uncheck();await dialog.getByRole('button',{name:'Save permissions'}).click();
 await tab(page,'Permissions');await expect(page.locator('.access-matrix-row').filter({hasText:'Apply allowed discounts'}).getByLabel('Cashier: denied')).toBeVisible();
});
test('Supervisor assignments preserve outside sites; Cashier cannot edit accounts',async({page})=>{
 await open(page);await choose(page,'Preview identity','supervisor');
 await expect(page.getByRole('button',{name:'Create new user',exact:true})).toHaveCount(0);await expect(page.locator('.access-user-row')).toHaveCount(4);
 await viewUser(page,'Sreypov');await page.getByRole('dialog').getByRole('button',{name:'Assign sites',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Full name')).toHaveCount(0);await expect(dialog.getByRole('heading',{name:'Assign sites',exact:true})).toBeVisible();
 const outside=dialog.locator('.access-site-choice').filter({hasText:'Street corner'}).getByRole('checkbox');await expect(outside).toBeChecked();await expect(outside).toBeDisabled();
 await dialog.getByLabel('Neighborhood',{exact:true}).check();await dialog.getByRole('button',{name:'Save assignment'}).click();await viewUser(page,'Sreypov');await expect(dialog).toContainText('Street corner');await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await choose(page,'Preview identity','sokha');await expect(page.locator('.access-user-row')).toHaveCount(1);await viewUser(page,'Sokha');await expect(page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true})).toHaveCount(0);await expect(page.getByRole('dialog').getByRole('button',{name:'Assign sites',exact:true})).toHaveCount(0);
});
test('Khmer account views fit a phone and permission matrix',async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem('onebite-language'));await page.route('**/functions/v1/admin-access',route=>route.abort());await page.goto('http://127.0.0.1:5174');await page.getByRole('button',{name:'បើកសាកល្បងក្នុងឧបករណ៍',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','km');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'ម៉ឺនុយគណនី'}).click();await page.getByRole('menuitem',{name:'English',exact:true}).click();await tab(page,'Permissions');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Module denial blocks saved actions and Admin access; re-enabling preserves action settings',async({page})=>{
 await open(page);await tab(page,'Roles');
 await reviewRole(page,'Supervisor');
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Access POS module',{exact:true}).uncheck();
 await expect(dialog.getByLabel('Receive orders',{exact:true})).toHaveCount(0);
 await dialog.getByLabel('Access Admin module',{exact:true}).uncheck();await expect(dialog.getByLabel('Assign existing staff to sites')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Save permissions'}).click();await tab(page,'Permissions');
 const pos=page.locator('.access-permission-module').filter({has:page.getByRole('heading',{name:'POS',exact:true})});
 await expect(pos.locator('.access-matrix-row').filter({hasText:'Receive orders'}).getByLabel('Supervisor: denied')).toBeVisible();
 await choose(page,'Preview identity','supervisor');await expect(page.getByRole('heading',{name:'Admin access denied'})).toBeVisible();
 await page.getByRole('button',{name:'Return to preview Owner'}).click();await tab(page,'Roles');
 await reviewRole(page,'Supervisor');
 await dialog.getByLabel('Access POS module',{exact:true}).check();await expect(dialog.getByLabel('Receive orders',{exact:true})).toBeChecked();await expect(dialog.getByLabel('Receive orders',{exact:true})).toBeEnabled();
 await dialog.getByLabel('Access Admin module',{exact:true}).check();await dialog.getByRole('button',{name:'Save permissions'}).click();
 await choose(page,'Preview identity','supervisor');await expect(page.locator('.access-user-row')).toHaveCount(4);
});
test('Custom menus support keyboard selection, Escape and modal focus restoration',async({page},info)=>{
 await open(page);await page.getByRole('button',{name:'Create new user',exact:true}).click();const dialog=page.getByRole('dialog');
 const role=dialog.getByLabel('Role',{exact:true});await role.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('listbox')).toBeVisible();await expect(page.getByRole('option',{name:'Cashier',exact:true})).toBeFocused();await page.keyboard.press('End');await expect(page.getByRole('option',{name:'Supervisor',exact:true})).toBeFocused();await page.keyboard.press('Enter');
 await expect(role).toContainText('Supervisor');
 await role.click();await page.keyboard.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(dialog).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Create new user',exact:true})).toBeFocused();
 await page.screenshot({path:`artifacts/admin-redesign-${info.project.name}.png`,fullPage:true});
 await tab(page,'Permissions');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`artifacts/admin-permissions-${info.project.name}.png`,fullPage:true});
});

test('New user requires a staff role and offers generated, regenerated and copyable PINs',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://127.0.0.1:5174'});
 await open(page);await page.getByRole('button',{name:'Create new user',exact:true}).click();const dialog=page.getByRole('dialog');
 const pin=dialog.getByLabel('Temporary 6-digit PIN',{exact:true});const first=await pin.inputValue();expect(first).toMatch(/^[0-9]{6}$/);
 const width=page.viewportSize()!.width;await page.setViewportSize({width,height:520});
 const create=dialog.getByRole('button',{name:'Create User',exact:true});const before=await create.boundingBox();expect(before).not.toBeNull();expect(before!.y+before!.height).toBeLessThanOrEqual(520);
 await dialog.locator('.modal-inner').evaluate(element=>{element.scrollTop=element.scrollHeight;});const after=await create.boundingBox();expect(after!.y).toBeCloseTo(before!.y,0);
 const boxes=await Promise.all([pin,dialog.getByRole('button',{name:'Regenerate PIN',exact:true}),dialog.getByRole('button',{name:'Copy PIN',exact:true})].map(locator=>locator.boundingBox()));
 expect(boxes[0]!.y+boxes[0]!.height/2).toBeCloseTo(boxes[1]!.y+boxes[1]!.height/2,0);expect(boxes[1]!.y+boxes[1]!.height/2).toBeCloseTo(boxes[2]!.y+boxes[2]!.height/2,0);

 await expect(dialog.getByLabel('Account active',{exact:true})).toHaveCount(0);await expect(dialog.getByText('Assigned sites',{exact:true})).toHaveCount(0);await expect(dialog.getByLabel('Confirm PIN')).toHaveCount(0);
 await dialog.getByLabel('Full name').fill('Generated PIN Staff');await dialog.getByLabel('Username',{exact:true}).fill('generated.pin.staff');
 await expect(dialog.getByRole('button',{name:'Create User',exact:true})).toBeDisabled();await expect(dialog.getByLabel('Role',{exact:true})).toContainText('Select a role');
 await dialog.getByRole('button',{name:'Regenerate PIN'}).click();const next=await pin.inputValue();expect(next).toMatch(/^[0-9]{6}$/);expect(next).not.toBe(first);
 await dialog.getByRole('button',{name:'Copy PIN',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('PIN copied');expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(next);
 await dialog.getByLabel('Role',{exact:true}).click();await expect(page.getByRole('option',{name:'Owner',exact:true})).toHaveCount(0);await page.getByRole('option',{name:'Cashier',exact:true}).click();
 await dialog.getByRole('button',{name:'Create User',exact:true}).click();const row=page.locator('.access-user-row').filter({hasText:'Generated PIN Staff'});await expect(row).toContainText('Active');await row.click();await expect(page.getByRole('dialog')).toContainText('No sites');
});

test('Users are grouped and alphabetized; filters combine and user details open before editing',async({page})=>{
 await open(page);const groups=page.locator('.access-user-group');await expect(groups).toHaveCount(3);
 const cashiers=page.getByRole('region',{name:'Cashier',exact:true});await expect(cashiers.locator('.access-person strong')).toHaveText(['Chantha','Pisey','Sokha','Sreypov']);
 const create=page.getByRole('button',{name:'Create new user',exact:true});await expect(create).toHaveText('');
 const roles=page.getByRole('group',{name:'Filter role',exact:true});await roles.getByRole('button',{name:'Supervisor',exact:true}).click();await expect(page.locator('.access-user-row')).toHaveCount(1);await expect(groups).toHaveCount(1);
 await page.getByRole('textbox',{name:'Search users',exact:true}).fill('sokha');await expect(page.getByRole('heading',{name:'No matching users'})).toBeVisible();
 await roles.getByRole('button',{name:'All roles',exact:true}).click();await expect(page.locator('.access-user-row')).toHaveCount(1);
 const row=page.locator('.access-user-row');await row.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'User details',exact:true})).toBeVisible();await expect(dialog).toContainText('@sokha');await expect(dialog).toContainText('Riverside');
 await dialog.getByRole('button',{name:'Edit',exact:true}).click();await dialog.getByLabel('Account active',{exact:true}).uncheck();await dialog.getByRole('button',{name:'Save changes'}).click();
 await choose(page,'Filter status','active');await expect(page.getByRole('heading',{name:'No matching users'})).toBeVisible();
 await choose(page,'Filter status','inactive');await expect(page.locator('.access-user-row')).toHaveCount(1);await expect(page.locator('.access-user-row')).toContainText('Inactive');
 await page.getByRole('textbox',{name:'Search users',exact:true}).fill('');await choose(page,'Filter status','all');await expect(page.locator('.access-user-row')).toHaveCount(6);
});

test('Title bar profile actions, theme persistence and menu keyboard dismissal',async({page},info)=>{
 await open(page);await expect(page.locator('.ob-app-identity strong')).toHaveText('OneBite - Admin');await expect(page.locator('.ob-app-identity span')).toHaveCount(0);
 const sync=page.locator('.ob-sync');await expect(sync).toHaveCSS('border-top-width','0px');const center=await sync.locator('.ob-sync-count').boundingBox(),ring=await sync.locator('.ob-sync-ring').boundingBox();expect(center&&ring&&Math.abs(center.x+center.width/2-ring.x-ring.width/2)<1&&Math.abs(center.y+center.height/2-ring.y-ring.height/2)<1).toBe(true);
 await page.getByRole('button',{name:'Profile menu',exact:true}).click();await page.getByRole('menuitem',{name:'My profile',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('@dara');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Profile menu',exact:true}).click();await page.getByRole('menuitem',{name:'Dark mode',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.screenshot({path:`artifacts/admin-titlebar-dark-${info.project.name}.png`,fullPage:true});
 await page.reload();await page.getByRole('button',{name:'Open local preview'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 const badge=page.getByRole('button',{name:'Profile menu',exact:true});await badge.click();await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(badge).toBeFocused();
 await badge.click();await page.getByRole('menuitem',{name:'Light mode',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await badge.click();await page.getByRole('menuitem',{name:'ខ្មែរ',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','km');
 await page.getByRole('button',{name:'ម៉ឺនុយគណនី',exact:true}).click();await page.getByRole('menuitem',{name:'English',exact:true}).click();
 await badge.click();await page.getByRole('menuitem',{name:'Sign out',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome back',exact:true})).toBeVisible();
});

test('Live sync tracks in-flight changes, failures and successful refresh',async({page})=>{
 const {initialAccessState}=await import('../packages/core/src/access');const snapshot={...initialAccessState(),revision:0};
 await page.addInitScript(()=>sessionStorage.setItem('onebite-admin-session','a'.repeat(64)));
 let release:()=>void=()=>{},fail=false,hold=false;
 await page.route('**/functions/v1/admin-access',async route=>{
  const {action}=route.request().postDataJSON();if(hold)await new Promise<void>(resolve=>{release=resolve;});
  await route.fulfill({status:fail?503:200,json:fail?{error:'network_failed'}:{state:snapshot,actor:snapshot.users.find(u=>u.id==='owner'),ok:true}});
 });
 await page.goto('http://127.0.0.1:5174');const sync=page.locator('.ob-sync');await expect(sync).toHaveAttribute('data-state','complete');await expect(sync.locator('.ob-sync-center')).toBeVisible();
 hold=true;await sync.click();await expect(sync).toHaveAttribute('data-state','syncing');await expect(sync).toBeDisabled();await expect(sync.locator('.ob-sync-count')).toHaveText('0');release();await expect(sync).toHaveAttribute('data-state','complete');
 await page.getByRole('button',{name:'Create new user',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Full name').fill('Sync Tester');await dialog.getByLabel('Username',{exact:true}).fill('sync.tester');await choose(page,'Role','Cashier');
 fail=true;await dialog.getByRole('button',{name:'Create User',exact:true}).click();await expect(sync.locator('.ob-sync-count')).toHaveText('1');await expect(sync).toHaveAttribute('data-state','syncing');release();await expect(sync).toHaveAttribute('data-state','failed');await expect(sync.locator('.ob-sync-count')).toHaveCount(0);await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByLabel('Username',{exact:true})).toHaveValue('sync.tester');
 await page.keyboard.press('Escape');fail=false;hold=false;await sync.click();await expect(sync).toHaveAttribute('data-state','complete');
});

for(const conflict of [false,true])test(`Stale user save ${conflict?'preserves draft and reloads a changed record':'refreshes unrelated changes and retries once'}`,async({page})=>{
 const {initialAccessState}=await import('../packages/core/src/access');const original={...initialAccessState(),revision:1};const latest=structuredClone(original);latest.revision=2;if(conflict)latest.users.find(user=>user.id==='owner')!.name='New server name';else latest.users.find(user=>user.id==='sokha')!.name='Changed elsewhere';
 let reads=0;const writes:Array<Record<string,unknown>>=[];
 await page.addInitScript(()=>sessionStorage.setItem('onebite-admin-session','a'.repeat(64)));
 await page.route('**/functions/v1/admin-access',async route=>{
  const {action,payload}=route.request().postDataJSON();if(action==='me'){const state=++reads===1?original:latest;await route.fulfill({json:{state,actor:state.users.find(user=>user.id==='owner')}});return;}
  writes.push(payload);if(writes.length===1){await route.fulfill({status:409,json:{error:'stale_revision'}});return;}
  const updated=structuredClone(latest);Object.assign(updated.users.find(user=>user.id==='owner')!,payload);updated.revision=3;await route.fulfill({json:{state:updated,ok:true}});
 });
 await page.goto('http://127.0.0.1:5174');await editUser(page,'Dara');const dialog=page.getByRole('dialog');await dialog.getByLabel('Full name').fill('My draft');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 if(conflict){await expect(dialog.getByRole('alert')).toContainText('Data changed');await expect(dialog.getByLabel('Full name')).toHaveValue('My draft');expect(writes).toHaveLength(1);await dialog.getByRole('button',{name:'Reload latest · Discard this draft',exact:true}).click();await expect(dialog.getByLabel('Full name')).toHaveValue('New server name');await dialog.getByLabel('Full name').fill('Reviewed draft');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();}
 await expect(dialog).toHaveCount(0);expect(writes).toHaveLength(2);expect(writes.map(write=>write.revision)).toEqual([1,2]);await expect(page.locator('.access-user-row').filter({hasText:conflict?'Reviewed draft':'My draft'})).toBeVisible();await expect(page.locator('.ob-sync')).toHaveAttribute('data-state','complete');
});

test('Owner edits profiles separately from site assignments and preserves existing sites',async({page})=>{
 await open(page);await editUser(page,'Sokha');const dialog=page.getByRole('dialog');await expect(dialog.getByText('Assigned sites',{exact:true})).toHaveCount(0);await expect(dialog.locator('.access-site-choice')).toHaveCount(0);await dialog.getByLabel('Full name').fill('Sokha Updated');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 await viewUser(page,'Sokha Updated');await expect(dialog).toContainText('Riverside');await dialog.getByRole('button',{name:'Assign sites',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Assign sites',exact:true})).toBeVisible();await expect(dialog.getByLabel('Riverside',{exact:true})).toBeChecked();await dialog.getByLabel('Riverside',{exact:true}).uncheck();await expect(dialog.getByRole('button',{name:'Save assignment',exact:true})).toBeDisabled();await dialog.getByLabel('Neighborhood',{exact:true}).check();await dialog.getByRole('button',{name:'Save assignment',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Open local preview'}).click();await viewUser(page,'Sokha Updated');await expect(dialog).toContainText('Neighborhood');await expect(dialog).not.toContainText('Riverside');await dialog.getByRole('button',{name:'Close',exact:true}).click();await viewUser(page,'Dara');await expect(dialog.getByRole('button',{name:'Assign sites',exact:true})).toHaveCount(0);
});

test('Role rows collapse by default and show only allowed modules when expanded',async({page},info)=>{
 await open(page);await tab(page,'Roles');const rows=page.locator('.access-role-row');await expect(rows).toHaveCount(3);await expect(page.getByRole('button',{name:'Review permissions',exact:true})).toHaveCount(0);
 const cashier=rows.filter({has:page.getByRole('heading',{name:'Cashier',exact:true})});const toggle=cashier.getByRole('button',{name:'Cashier',exact:true});await expect(toggle).toHaveAttribute('aria-expanded','false');await toggle.focus();await page.keyboard.press('Space');await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(cashier.locator('.access-role-modules li')).toHaveText(['POS','Admin']);await expect(cashier.getByRole('button',{name:'Review permissions',exact:true})).toBeVisible();
 await cashier.getByRole('button',{name:'Review permissions',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Access POS module',{exact:true}).uncheck();await dialog.getByRole('button',{name:'Save permissions'}).click();await expect(cashier.locator('.access-role-modules li')).toHaveText(['Admin']);
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(cashier.getByRole('button',{name:'Review permissions',exact:true})).toHaveCount(0);await rows.filter({has:page.getByRole('heading',{name:'Owner',exact:true})}).getByRole('button',{name:'Owner',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`artifacts/admin-roles-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Profile menu',exact:true}).click();await page.getByRole('menuitem',{name:'Dark mode',exact:true}).click();await page.screenshot({path:`artifacts/admin-roles-dark-${info.project.name}.png`,fullPage:true});
});

test('Permission sections use switches, hide denied actions and keep save visible',async({page},info)=>{
 await open(page);await tab(page,'Roles');await reviewRole(page,'Supervisor');const dialog=page.getByRole('dialog');const pos=dialog.getByRole('region',{name:'POS',exact:true});const module=pos.getByRole('switch',{name:'Access POS module',exact:true});await expect(module).toBeChecked();await expect(pos.getByText('Allowed',{exact:true})).toBeVisible();await expect(pos.locator('.access-policy-actions li')).toHaveCount(9);
 const discount=pos.getByRole('switch',{name:'Apply allowed discounts',exact:true});await discount.focus();await page.keyboard.press('Space');await expect(discount).not.toBeChecked();await module.uncheck();await expect(pos.getByText('Denied',{exact:true})).toBeVisible();await expect(pos.locator('.access-policy-actions')).toHaveCount(0);await module.check();await expect(discount).not.toBeChecked();await expect(pos.getByRole('switch',{name:'Override discount limits',exact:true})).toBeDisabled();await expect(pos.getByRole('switch',{name:'Refund or cancel paid invoices',exact:true})).toBeDisabled();
 await page.screenshot({path:`artifacts/admin-permission-editor-${info.project.name}.png`,fullPage:true,animations:'disabled'});const viewport=page.viewportSize()!;await page.setViewportSize({...viewport,height:520});const save=dialog.getByRole('button',{name:'Save permissions',exact:true});const before=await save.boundingBox();await dialog.locator('.modal-inner').evaluate(element=>{element.scrollTop=element.scrollHeight;});const after=await save.boundingBox();expect(before&&after&&Math.abs(before.y-after.y)<1&&after.y+after.height<=520).toBe(true);await save.click();
 await reviewRole(page,'Supervisor');await expect(dialog.getByRole('switch',{name:'Apply allowed discounts',exact:true})).not.toBeChecked();await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.setViewportSize(viewport);await page.getByRole('button',{name:'Profile menu',exact:true}).click();await page.getByRole('menuitem',{name:'Dark mode',exact:true}).click();await reviewRole(page,'Supervisor');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`artifacts/admin-permission-editor-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});

test('empty directories offer creation only with permission and clear filters without changing data',async({page},info)=>{
 await open(page);await tab(page,'Activity');await page.locator('.ob-empty-state').getByRole('button',{name:'Create new user',exact:true}).click();await expect(page.getByRole('dialog').getByLabel('Role',{exact:true})).toContainText('Select a role');await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await tab(page,'Users');await page.getByRole('textbox',{name:'Search users',exact:true}).fill('no-such-team-member');
 const empty=page.locator('.ob-empty-state');await expect(empty.getByRole('heading',{name:'No matching users'})).toBeVisible();
 await empty.getByRole('button',{name:'Create new user',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Create new user',exact:true})).toBeVisible();await expect(dialog.getByLabel('Full name')).toHaveValue('');await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await empty.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.locator('.access-user-row')).toHaveCount(6);
 await choose(page,'Preview identity','supervisor');await page.getByRole('textbox',{name:'Search users',exact:true}).fill('no-such-team-member');await expect(empty).toBeVisible();await expect(empty.getByRole('button',{name:'Create new user',exact:true})).toHaveCount(0);await empty.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.locator('.access-user-row')).toHaveCount(4);
 await choose(page,'Preview identity','owner');await page.getByRole('textbox',{name:'Search users',exact:true}).fill('no-such-team-member');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`artifacts/admin-empty-state-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Profile menu',exact:true}).click();await page.getByRole('menuitem',{name:'Dark mode',exact:true}).click();await expect(empty.getByRole('button',{name:'Create new user',exact:true})).toBeVisible();await page.screenshot({path:`artifacts/admin-empty-state-dark-${info.project.name}.png`,fullPage:true,animations:'disabled'});
});


test('Admin pages share a title and subtitle header with the user action on the right',async({page},info)=>{
 await open(page);const header=page.locator('.ob-page-heading');await expect(header.getByRole('heading',{level:1})).toHaveText('Users');await expect(header.locator('p')).toHaveText('Manage your team and account access.');const create=header.getByRole('button',{name:'Create new user',exact:true});await expect(create).toBeVisible();const titleBox=await header.locator('.ob-page-heading-copy').boundingBox(),actionBox=await create.boundingBox();expect(actionBox!.x).toBeGreaterThan(titleBox!.x+titleBox!.width);await expect(page.getByLabel('Filter status',{exact:true})).toContainText('Active');await page.screenshot({path:`artifacts/admin-page-header-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 for(const [name,title,subtitle] of [['Roles','Roles','Review each role and its allowed modules.'],['Permissions','Permissions','Control module access and actions for each role.'],['Activity','Activity log','Track account, role, and permission changes.']]){await tab(page,name);await expect(header.getByRole('heading',{level:1})).toHaveText(title);await expect(header.locator('p')).toHaveText(subtitle);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await choose(page,'Preview identity','supervisor');await expect(header.getByRole('button',{name:'Create new user',exact:true})).toHaveCount(0);await expect(header.locator('p')).toHaveText('Manage your team and account access.');
});

test('Owner creates a custom role, configures permissions and assigns it to a user',async({page},info)=>{
 await open(page);await tab(page,'Roles');await expect(page.locator('.ob-page-heading h1')).toHaveText('Roles');const create=page.locator('.ob-page-heading').getByRole('button',{name:'Create new role',exact:true});await expect(create).toHaveText('');await create.click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Create Role',exact:true})).toBeDisabled();await dialog.getByLabel('Role name',{exact:true}).fill('Cashier');await expect(dialog.getByRole('alert')).toContainText('already used');await dialog.getByLabel('Role name',{exact:true}).fill('Shift Lead');await dialog.getByLabel('Short description',{exact:true}).fill('Support the team at the site.');
 await expect(dialog.getByRole('switch',{name:'Access Inventory module',exact:true})).toBeDisabled();await expect(dialog.getByRole('switch',{name:'Access Attendance module',exact:true})).toBeDisabled();await dialog.getByRole('switch',{name:'Access Admin module',exact:true}).check();await dialog.getByRole('switch',{name:'Manage user accounts',exact:true}).check();await expect(dialog.getByRole('switch',{name:'Manage sites',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Create Role',exact:true}).click();await expect(page.locator('.access-role-row')).toHaveCount(4);await reviewRole(page,'Shift Lead');await expect(dialog.getByRole('switch',{name:'Manage user accounts',exact:true})).toBeChecked();await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Open local preview'}).click();await editUser(page,'Sokha');await page.getByLabel('Role',{exact:true}).click();await page.getByRole('option',{name:'Shift Lead',exact:true}).click();await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('region',{name:'Shift Lead',exact:true})).toContainText('Sokha');
 await tab(page,'Permissions');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await tab(page,'Roles');await reviewRole(page,'Owner');await expect(dialog.getByRole('switch',{name:'Access Admin module',exact:true})).toBeDisabled();await expect(dialog.getByRole('switch',{name:'Manage role permissions',exact:true})).toBeDisabled();await dialog.getByRole('switch',{name:'Apply allowed discounts',exact:true}).uncheck();await page.screenshot({path:`artifacts/admin-owner-permissions-${info.project.name}.png`,fullPage:true,animations:'disabled'});await dialog.getByRole('button',{name:'Save permissions',exact:true}).click();await reviewRole(page,'Owner');await expect(dialog.getByRole('switch',{name:'Apply allowed discounts',exact:true})).not.toBeChecked();await dialog.getByRole('button',{name:'Close',exact:true}).click();await choose(page,'Preview identity','supervisor');await tab(page,'Roles');await expect(page.getByRole('button',{name:'Create new role',exact:true})).toHaveCount(0);
});

test('Role creation waits for a current backend snapshot and unlocks after sync',async({page})=>{
 const {initialAccessState}=await import('../packages/core/src/access');const state={...initialAccessState(),revision:0};let modern=false;await page.addInitScript(()=>sessionStorage.setItem('onebite-admin-session','a'.repeat(64)));await page.route('**/functions/v1/admin-access',r=>r.fulfill({json:{actor:state.users[0],state:modern?{...state,customRoles:[]}:state}}));await page.goto('http://127.0.0.1:5174');await tab(page,'Roles');await expect(page.getByRole('button',{name:'Create new role',exact:true})).toBeDisabled();await reviewRole(page,'Cashier');await expect(page.getByRole('dialog').getByRole('switch',{name:'Manage user accounts',exact:true})).toBeDisabled();await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();modern=true;await page.locator('.ob-sync').click();await expect(page.getByRole('button',{name:'Create new role',exact:true})).toBeEnabled();await reviewRole(page,'Cashier');await expect(page.getByRole('dialog').getByRole('switch',{name:'Manage user accounts',exact:true})).toBeEnabled();
});
