import { test, expect, type Page } from '@playwright/test';
test.beforeEach(async({page},info)=>{if(!info.title.startsWith('Khmer'))await page.addInitScript(()=>localStorage.setItem('onebite-language','en'));});
async function open(page:Page){await page.route('**/functions/v1/admin-access',route=>route.abort());await page.goto('http://127.0.0.1:5174');await page.getByRole('button',{name:'Open local preview'}).click();}
async function choose(page:Page,label:string,value:string){await page.getByLabel(label,{exact:true}).click();await page.locator(`[role="option"][data-value="${value}"]`).click();}
async function viewUser(page:Page,name:string){await page.locator('.access-user-row').filter({hasText:name}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:'User details',exact:true})).toBeVisible();}
async function editUser(page:Page,name:string){await viewUser(page,name);await page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true}).click();}
async function tab(page:Page,name:string){await page.getByRole('button',{name,exact:true}).filter({visible:true}).click();}
test('Owner creates and edits accounts, prevents duplicates, preserves changes and audits them',async({page})=>{
 await open(page);await expect(page.locator('.access-user-row')).toHaveCount(6);
 await page.getByRole('button',{name:'Create new user',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Full name').fill('Test Staff');await dialog.getByLabel('Username',{exact:true}).fill('sokha');
 await expect(dialog.getByRole('alert')).toContainText('already used');await expect(dialog.getByRole('button',{name:'Create User',exact:true})).toBeDisabled();
 await dialog.getByLabel('Username',{exact:true}).fill('test.staff');await choose(page,'Role','Cashier');await dialog.getByRole('button',{name:'Create User',exact:true}).click();
 await expect(page.locator('.access-user-row')).toHaveCount(7);await page.reload();await page.getByRole('button',{name:'Open local preview'}).click();
 await editUser(page,'Test Staff');await dialog.getByLabel('Account active',{exact:true}).uncheck();await dialog.getByRole('button',{name:'Save changes'}).click();
 await choose(page,'Filter status','inactive');await expect(page.locator('.access-user-row')).toHaveCount(1);await expect(page.locator('.access-user-row')).toContainText('Test Staff');
 await tab(page,'Activity');await expect(page.locator('.access-activity')).toContainText('Test Staff');await expect(page.locator('.access-activity')).toContainText('Dara');
});
test('Protects the last Owner and enforces role ceilings',async({page})=>{
 await open(page);await editUser(page,'Dara');const dialog=page.getByRole('dialog');
 await expect(dialog.getByLabel('Role',{exact:true})).toBeDisabled();await expect(dialog.getByLabel('Account active',{exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await tab(page,'Roles');await page.locator('.access-role-card').filter({has:page.getByRole('heading',{name:'Cashier',exact:true})}).getByRole('button').click();
 await expect(dialog.getByLabel('Manage user accounts')).toBeDisabled();await expect(dialog.getByLabel('Override discount limits')).toBeDisabled();await expect(dialog.getByLabel('Refund or cancel paid invoices')).toBeDisabled();
 await dialog.getByLabel('Apply allowed discounts').uncheck();await dialog.getByRole('button',{name:'Save permissions'}).click();
 await tab(page,'Permissions');await expect(page.locator('.access-matrix-row').filter({hasText:'Apply allowed discounts'}).getByLabel('Cashier: denied')).toBeVisible();
});
test('Supervisor assignments preserve outside sites; Cashier cannot edit accounts',async({page})=>{
 await open(page);await choose(page,'Preview identity','supervisor');
 await expect(page.getByRole('button',{name:'Create new user',exact:true})).toHaveCount(0);await expect(page.locator('.access-user-row')).toHaveCount(4);
 await editUser(page,'Sreypov');const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Full name')).toHaveCount(0);
 const outside=dialog.locator('.access-site-choice').filter({hasText:'Street corner'}).getByRole('checkbox');await expect(outside).toBeChecked();await expect(outside).toBeDisabled();
 await dialog.getByLabel('Neighborhood',{exact:true}).check();await dialog.getByRole('button',{name:'Save changes'}).click();await viewUser(page,'Sreypov');await expect(dialog).toContainText('Street corner');await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await choose(page,'Preview identity','sokha');await expect(page.locator('.access-user-row')).toHaveCount(1);await viewUser(page,'Sokha');await expect(page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true})).toHaveCount(0);
});
test('Khmer account views fit a phone and permission matrix',async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem('onebite-language'));await page.route('**/functions/v1/admin-access',route=>route.abort());await page.goto('http://127.0.0.1:5174');await page.getByRole('button',{name:'បើកសាកល្បងក្នុងឧបករណ៍',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','km');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'ម៉ឺនុយគណនី'}).click();await page.getByRole('menuitem',{name:'English',exact:true}).click();await tab(page,'Permissions');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Module denial blocks saved actions and Admin access; re-enabling preserves action settings',async({page})=>{
 await open(page);await tab(page,'Roles');
 await page.locator('.access-role-card').filter({has:page.getByRole('heading',{name:'Supervisor',exact:true})}).getByRole('button').click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Access POS module',{exact:true}).uncheck();
 await expect(dialog.getByLabel('Receive orders',{exact:true})).toBeChecked();await expect(dialog.getByLabel('Receive orders',{exact:true})).toBeDisabled();
 await dialog.getByLabel('Access Admin module',{exact:true}).uncheck();await expect(dialog.getByLabel('Assign existing staff to sites')).toBeDisabled();
 await dialog.getByRole('button',{name:'Save permissions'}).click();await tab(page,'Permissions');
 const pos=page.locator('.access-permission-module').filter({has:page.getByRole('heading',{name:'POS',exact:true})});
 await expect(pos.locator('.access-matrix-row').filter({hasText:'Receive orders'}).getByLabel('Supervisor: denied')).toBeVisible();
 await choose(page,'Preview identity','supervisor');await expect(page.getByRole('heading',{name:'Admin access denied'})).toBeVisible();
 await page.getByRole('button',{name:'Return to preview Owner'}).click();await tab(page,'Roles');
 await page.locator('.access-role-card').filter({has:page.getByRole('heading',{name:'Supervisor',exact:true})}).getByRole('button').click();
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
