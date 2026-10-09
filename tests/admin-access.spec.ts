import { test, expect, type Page } from '@playwright/test';
test.beforeEach(async({page},info)=>{if(!info.title.startsWith('Khmer'))await page.addInitScript(()=>localStorage.setItem('onebite-language','en'));});
async function open(page:Page){await page.route('**/functions/v1/admin-access',route=>route.abort());await page.goto('http://127.0.0.1:5174');await page.getByRole('button',{name:'Open local preview'}).click();}
async function tab(page:Page,name:string){await page.getByRole('button',{name,exact:true}).filter({visible:true}).click();}
test('Owner creates and edits accounts, prevents duplicates, preserves changes and audits them',async({page})=>{
 await open(page);await expect(page.locator('.access-user-row')).toHaveCount(6);
 await page.getByRole('button',{name:'Add user',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Full name').fill('Test Staff');await dialog.getByLabel('Username',{exact:true}).fill('sokha');
 await expect(dialog.getByRole('alert')).toContainText('already used');await expect(dialog.getByRole('button',{name:'Save changes'})).toBeDisabled();
 await dialog.getByLabel('Username',{exact:true}).fill('test.staff');await dialog.getByLabel('Riverside',{exact:true}).check();await dialog.getByRole('button',{name:'Save changes'}).click();
 await expect(page.locator('.access-user-row')).toHaveCount(7);await page.reload();await page.getByRole('button',{name:'Open local preview'}).click();
 await page.getByRole('button',{name:'Edit Test Staff',exact:true}).click();await dialog.getByLabel('Account active',{exact:true}).uncheck();await dialog.getByRole('button',{name:'Save changes'}).click();
 await page.getByLabel('Filter status').selectOption('inactive');await expect(page.locator('.access-user-row')).toHaveCount(1);await expect(page.locator('.access-user-row')).toContainText('Test Staff');
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
 await open(page);await page.getByLabel('Preview identity').selectOption('supervisor');
 await expect(page.getByRole('button',{name:'Add user',exact:true})).toHaveCount(0);await expect(page.locator('.access-user-row')).toHaveCount(4);
 await page.getByRole('button',{name:'Edit Sreypov',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Full name')).toHaveCount(0);
 const outside=dialog.locator('.access-site-choice').filter({hasText:'Street corner'}).getByRole('checkbox');await expect(outside).toBeChecked();await expect(outside).toBeDisabled();
 await dialog.getByLabel('Neighborhood',{exact:true}).check();await dialog.getByRole('button',{name:'Save changes'}).click();await expect(page.locator('.access-user-row').filter({hasText:'Sreypov'})).toContainText('Street corner');
 await page.getByLabel('Preview identity').selectOption('sokha');await expect(page.locator('.access-user-row')).toHaveCount(1);await expect(page.getByRole('button',{name:/^Edit /})).toHaveCount(0);
});
test('Khmer account views fit a phone and permission matrix',async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem('onebite-language'));await page.route('**/functions/v1/admin-access',route=>route.abort());await page.goto('http://127.0.0.1:5174');await page.getByRole('button',{name:'បើកសាកល្បងក្នុងឧបករណ៍',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','km');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.access-language').click();await tab(page,'Permissions');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
