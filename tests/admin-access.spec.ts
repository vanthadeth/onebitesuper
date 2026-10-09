import { test, expect, type Page } from '@playwright/test';
test.beforeEach(async({page},info)=>{if(!info.title.startsWith('Khmer'))await page.addInitScript(()=>localStorage.setItem('onebite-language','en'));});
async function open(page:Page){await page.route('**/functions/v1/admin-access',route=>route.abort());await page.goto('http://127.0.0.1:5174');await page.getByRole('button',{name:'Open local preview'}).click();}
async function choose(page:Page,label:string,value:string){await page.getByLabel(label,{exact:true}).click();await page.locator(`[role="option"][data-value="${value}"]`).click();}
async function tab(page:Page,name:string){await page.getByRole('button',{name,exact:true}).filter({visible:true}).click();}
test('Owner creates and edits accounts, prevents duplicates, preserves changes and audits them',async({page})=>{
 await open(page);await expect(page.locator('.access-user-row')).toHaveCount(6);
 await page.getByRole('button',{name:'Add user',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Full name').fill('Test Staff');await dialog.getByLabel('Username',{exact:true}).fill('sokha');
 await expect(dialog.getByRole('alert')).toContainText('already used');await expect(dialog.getByRole('button',{name:'Save changes'})).toBeDisabled();
 await dialog.getByLabel('Username',{exact:true}).fill('test.staff');await choose(page,'Role','Cashier');await dialog.getByRole('button',{name:'Save changes'}).click();
 await expect(page.locator('.access-user-row')).toHaveCount(7);await page.reload();await page.getByRole('button',{name:'Open local preview'}).click();
 await page.getByRole('button',{name:'Edit Test Staff',exact:true}).click();await dialog.getByLabel('Account active',{exact:true}).uncheck();await dialog.getByRole('button',{name:'Save changes'}).click();
 await choose(page,'Filter status','inactive');await expect(page.locator('.access-user-row')).toHaveCount(1);await expect(page.locator('.access-user-row')).toContainText('Test Staff');
 await tab(page,'Activity');await expect(page.locator('.access-activity')).toContainText('Test Staff');await expect(page.locator('.access-activity')).toContainText('Dara');
});
test('Protects the last Owner and enforces role ceilings',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Edit Dara',exact:true}).click();const dialog=page.getByRole('dialog');
 await expect(dialog.getByLabel('Role',{exact:true})).toBeDisabled();await expect(dialog.getByLabel('Account active',{exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await tab(page,'Roles');await page.locator('.access-role-card').filter({has:page.getByRole('heading',{name:'Cashier',exact:true})}).getByRole('button').click();
 await expect(dialog.getByLabel('Manage user accounts')).toBeDisabled();await expect(dialog.getByLabel('Override discount limits')).toBeDisabled();await expect(dialog.getByLabel('Refund or cancel paid invoices')).toBeDisabled();
 await dialog.getByLabel('Apply allowed discounts').uncheck();await dialog.getByRole('button',{name:'Save permissions'}).click();
 await tab(page,'Permissions');await expect(page.locator('.access-matrix-row').filter({hasText:'Apply allowed discounts'}).getByLabel('Cashier: denied')).toBeVisible();
});
test('Supervisor assignments preserve outside sites; Cashier cannot edit accounts',async({page})=>{
 await open(page);await choose(page,'Preview identity','supervisor');
 await expect(page.getByRole('button',{name:'Add user',exact:true})).toHaveCount(0);await expect(page.locator('.access-user-row')).toHaveCount(4);
 await page.getByRole('button',{name:'Edit Sreypov',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Full name')).toHaveCount(0);
 const outside=dialog.locator('.access-site-choice').filter({hasText:'Street corner'}).getByRole('checkbox');await expect(outside).toBeChecked();await expect(outside).toBeDisabled();
 await dialog.getByLabel('Neighborhood',{exact:true}).check();await dialog.getByRole('button',{name:'Save changes'}).click();await expect(page.locator('.access-user-row').filter({hasText:'Sreypov'})).toContainText('Street corner');
 await choose(page,'Preview identity','sokha');await expect(page.locator('.access-user-row')).toHaveCount(1);await expect(page.getByRole('button',{name:/^Edit /})).toHaveCount(0);
});
test('Khmer account views fit a phone and permission matrix',async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem('onebite-language'));await page.route('**/functions/v1/admin-access',route=>route.abort());await page.goto('http://127.0.0.1:5174');await page.getByRole('button',{name:'បើកសាកល្បងក្នុងឧបករណ៍',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','km');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.access-language').click();await tab(page,'Permissions');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
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
 await open(page);await page.getByRole('button',{name:'Add user',exact:true}).click();const dialog=page.getByRole('dialog');
 const role=dialog.getByLabel('Role',{exact:true});await role.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('listbox')).toBeVisible();await expect(page.getByRole('option',{name:'Cashier',exact:true})).toBeFocused();await page.keyboard.press('End');await expect(page.getByRole('option',{name:'Supervisor',exact:true})).toBeFocused();await page.keyboard.press('Enter');
 await expect(role).toContainText('Supervisor');
 await role.click();await page.keyboard.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(dialog).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Add user',exact:true})).toBeFocused();
 await page.screenshot({path:`artifacts/admin-redesign-${info.project.name}.png`,fullPage:true});
 await tab(page,'Permissions');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`artifacts/admin-permissions-${info.project.name}.png`,fullPage:true});
});

test('New user requires a staff role and offers generated, regenerated and copyable PINs',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://127.0.0.1:5174'});
 await open(page);await page.getByRole('button',{name:'Add user',exact:true}).click();const dialog=page.getByRole('dialog');
 const pin=dialog.getByLabel('Temporary 6-digit PIN',{exact:true});const first=await pin.inputValue();expect(first).toMatch(/^[0-9]{6}$/);
 await expect(dialog.getByLabel('Account active',{exact:true})).toHaveCount(0);await expect(dialog.getByText('Assigned sites',{exact:true})).toHaveCount(0);await expect(dialog.getByLabel('Confirm PIN')).toHaveCount(0);
 await dialog.getByLabel('Full name').fill('Generated PIN Staff');await dialog.getByLabel('Username',{exact:true}).fill('generated.pin.staff');
 await expect(dialog.getByRole('button',{name:'Save changes'})).toBeDisabled();await expect(dialog.getByLabel('Role',{exact:true})).toContainText('Select a role');
 await dialog.getByRole('button',{name:'Regenerate PIN'}).click();const next=await pin.inputValue();expect(next).toMatch(/^[0-9]{6}$/);expect(next).not.toBe(first);
 await dialog.getByRole('button',{name:'Copy PIN',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('PIN copied');expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(next);
 await dialog.getByLabel('Role',{exact:true}).click();await expect(page.getByRole('option',{name:'Owner',exact:true})).toHaveCount(0);await page.getByRole('option',{name:'Cashier',exact:true}).click();
 await dialog.getByRole('button',{name:'Save changes'}).click();const row=page.locator('.access-user-row').filter({hasText:'Generated PIN Staff'});await expect(row).toContainText('Active');await expect(row).toContainText('No sites');
});
