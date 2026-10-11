import {test,expect,type Page} from '@playwright/test';
import jpeg from 'jpeg-js';
import {newCatalogItem,newUnifiedItem,itemDefinition,type CatalogItem,type CatalogReference} from '../packages/core/src/inventory';
import {defaultAppSettings} from '../packages/core/src/app-settings';
const token='b'.repeat(64),actor={id:'11111111-1111-4111-8111-111111111111',name:'Inventory Owner',username:'inventory-owner',role:'Owner',sites:[],active:true};
async function fixture(page:Page,options:{staff?:boolean;items?:CatalogItem[];signin?:boolean}={}){
 let items=options.items||[],online=true,failSave='',saveCalls=0;const receipts=new Map<string,unknown>(),photos=new Map<string,string>();
 const identity:typeof actor&{photoPath?:string|null}=options.staff?{...actor,id:'22222222-2222-4222-8222-222222222222',role:'Cashier',name:'Inventory Cashier'}:actor;
 await page.addInitScript(({token,signin})=>{localStorage.setItem('onebite-language','en');if(!signin)localStorage.setItem('onebite-admin-session',JSON.stringify({token,expiresAt:Date.now()+3600000}));},{token,signin:options.signin});
 let references:CatalogReference[]=[['material_category','ingredient','Ingredient'],['material_category','packaging','Packaging'],['sellable_category','Dumplings','Dumplings'],['sellable_category','ingredient','Ingredient'],['sellable_category','packaging','Packaging'],['unit','pcs','Pieces'],['unit','g','Grams'],['unit','ml','Millilitres'],['unit','box','Box']].map(([kind,value,name])=>({id:crypto.randomUUID(),kind:kind as CatalogReference['kind'],value,name,active:true,revision:1}));
 let profilePhoto:string|null=null;
 await page.route('**/functions/v1/admin-access',route=>{const {action,payload}=route.request().postDataJSON();
  if(action==='profile.photo.upload'){profilePhoto='data:image/jpeg;base64,'+payload.image;return route.fulfill({json:{photoPath:identity.id+'/11111111-1111-4111-8111-111111111111.jpg'}});}
  if(action==='profile.photo.update'){if(payload.revision!==1)return route.fulfill({status:409,json:{error:'stale_revision'}});identity.photoPath=payload.photoPath;if(!payload.photoPath)profilePhoto=null;return route.fulfill({json:{ok:true}});}
  return route.fulfill({json:action==='login'?{actor:identity,session:token,sessionExpiresAt:Date.now()+3600000}:action==='me'?{actor:identity,state:{revision:1,users:[identity],sites:[],grants:{},events:[]}}:action==='profile.photo.read'?{photo:profilePhoto}:{ownerCreated:true,appSettings:defaultAppSettings}});
 });
 await page.route('**/functions/v1/inventory-access',async route=>{
  if(!online)return route.abort();const {action,payload}=route.request().postDataJSON();
  if(action==='list')return route.fulfill({json:{actor:identity,canEdit:!options.staff,items,references}});
  if(action==='reference.save'){
   if(options.staff)return route.fulfill({status:403,json:{error:'forbidden'}});
   if(receipts.has(payload.id))return route.fulfill({json:receipts.get(payload.id)});
   const current=references.find(reference=>reference.id===payload.reference.id);
   if((current?.revision||0)!==payload.reference.revision)return route.fulfill({status:409,json:{error:'stale_revision'}});
   if(current&&current.active!==payload.reference.active&&!payload.confirmedActive)return route.fulfill({status:409,json:{error:'confirmation_required'}});
   const reference={...payload.reference,revision:payload.reference.revision+1};references=[...references.filter(value=>value.id!==reference.id),reference];const receipt={reference};receipts.set(payload.id,receipt);return route.fulfill({json:receipt});
  }
  if(action==='save'){
   saveCalls++;if(options.staff)return route.fulfill({status:403,json:{error:'forbidden'}});if(failSave)return route.fulfill({status:409,json:{error:failSave}});
   if(receipts.has(payload.id))return route.fulfill({json:receipts.get(payload.id)});
   if((payload.item.definition?.lines??payload.item.recipe??[]).some((line:{itemId:string})=>!items.some(item=>item.id===line.itemId)))return route.fulfill({status:409,json:{error:'invalid_recipe'}});
   const current=items.find(item=>item.id===payload.item.id);
   if((current?.revision||0)!==payload.item.revision)return route.fulfill({status:409,json:{error:'stale_revision'}});
   const item={...payload.item,revision:payload.item.revision+1};if(payload.image){item.photoPath=identity.id+'/'+payload.id+'.jpg';photos.set(item.photoPath,payload.image);}items=[...items.filter(value=>value.id!==item.id),item];const receipt={item};receipts.set(payload.id,receipt);return route.fulfill({json:receipt});
  }
  if(action==='photo.read')return route.fulfill({json:{photo:photos.get(payload.photoPath)}});
  return route.fulfill({status:400,json:{error:'invalid_action'}});
 });
 await page.goto('http://127.0.0.1:5175');
 if(!options.signin)await expect(page.getByRole('heading',{name:'Items',exact:true})).toBeVisible();
 return {setOnline:(value:boolean)=>{online=value;},setFailure:(value:string)=>{failSave=value;},items:()=>items,calls:()=>saveCalls};
}
function nav(page:Page){return page.locator(page.viewportSize()!.width<680?'.access-bottom-nav':'.access-sidebar nav');}
async function createMaterial(page:Page,name='Wrapper'){
 await page.getByRole('button',{name:'New item',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Name',{exact:true}).fill(name);await dialog.getByLabel('Pack name',{exact:true}).fill('Pack');await dialog.getByLabel('Quantity per pack').fill('100');return dialog;
}
test('Owner creates real catalog records, edits and filters without sample data',async({page})=>{
 const server=await fixture(page);await expect(page.locator('.inventory-card')).toHaveCount(0);
 const dialog=await createMaterial(page);await expect(dialog.getByRole('switch',{name:'Active',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Create item',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 const toast=page.locator('.ob-app-messages .ob-feedback-toast').filter({hasText:'Saved on this device'});
 await expect(toast).toHaveCSS('position','static');await expect(toast).toBeInViewport();
 await toast.getByRole('button',{name:'Dismiss message'}).click();await expect(toast).toHaveCount(0);
 await expect(page.locator('.inventory-card')).toContainText('Wrapper');await expect(page.locator('.inventory-card')).not.toContainText('Pending sync');expect(server.items()[0].packQuantity).toBe(100);
 await page.getByRole('button',{name:'Wrapper',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true}).click();await expect(page.getByRole('dialog').getByRole('combobox',{name:'Base unit'})).toBeDisabled();await page.getByRole('switch',{name:'Active',exact:true}).click();await page.getByRole('dialog',{name:'Deactivate this record?'}).getByRole('button',{name:'Confirm',exact:true}).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.locator('.inventory-card')).toHaveCount(0);await page.getByRole('button',{name:'Status',exact:true}).click();await page.getByRole('menuitemradio',{name:'Inactive',exact:true}).click();await expect(page.locator('.inventory-card')).toContainText('Wrapper');
 await nav(page).getByRole('button',{name:'Items',exact:true}).click();await page.getByRole('button',{name:'New item',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Small dumpling box');await page.getByRole('switch',{name:'Can sell',exact:true}).click();await page.getByRole('combobox',{name:'Category',exact:true}).click();await page.getByRole('option',{name:'Dumplings',exact:true}).click();await page.getByLabel('Master price (KHR)',{exact:true}).fill('5000');await page.getByRole('button',{name:'Create item',exact:true}).click();await expect(page.locator('.inventory-card')).toContainText('5,000 KHR');await page.getByRole('searchbox').fill('Tea');await expect(page.locator('.inventory-card')).toHaveCount(0);await page.getByRole('button',{name:'Reset filters'}).click();await expect(page.locator('.inventory-card')).toHaveCount(1);expect(server.items()).toHaveLength(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('SQLite keeps offline edits through reload and publishes once after reconnect',async({page,context})=>{
 const server=await fixture(page);await expect(page.locator('.ob-sync')).toHaveAttribute('data-state','complete');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 server.setOnline(false);await context.setOffline(true);
 const dialog=await createMaterial(page,'Offline wrapper');await dialog.getByRole('button',{name:'Create item',exact:true}).click();await expect(page.locator('.inventory-card')).toContainText('Pending sync');await page.reload();await expect(page.locator('.inventory-card')).toContainText('Offline wrapper');await expect(page.locator('.ob-app-messages .d-alert-warning')).toContainText('Offline');expect(server.items()).toHaveLength(0);
 await nav(page).getByRole('button',{name:'Changes',exact:true}).click();await expect(page.locator('.inventory-change')).toHaveCount(1);server.setOnline(true);await context.setOffline(false);await expect(page.locator('.inventory-change')).toHaveCount(0);await expect(page.getByText('No pending changes', {exact:true})).toBeVisible();expect(server.items()).toHaveLength(1);await page.locator('.ob-sync').click();await expect(page.locator('.ob-sync')).toHaveAttribute('data-state','complete');expect(server.calls()).toBe(1);
});
test('stale changes stay visible for review and never overwrite the server',async({page})=>{
 const server=await fixture(page);server.setFailure('stale_revision');const dialog=await createMaterial(page,'Conflicting wrapper');await dialog.getByRole('button',{name:'Create item',exact:true}).click();await expect(page.locator('.inventory-card')).toContainText('Needs review');expect(server.items()).toHaveLength(0);await nav(page).getByRole('button',{name:'Changes',exact:true}).click();await expect(page.locator('.inventory-change')).toContainText('changed on another device');await page.getByRole('button',{name:'Review saved copy'}).click();await expect(page.getByRole('dialog')).toContainText('Pack · 100 pcs');await expect(page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Discard change',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Discard change',exact:true}).click();await expect(page.getByText('No pending changes',{exact:true})).toBeVisible();
});
test('staff view the catalog without catalog authoring controls',async({page})=>{
 const item={...newCatalogItem('material'),name:'Cucumber',unit:'g',revision:1};await fixture(page,{staff:true,items:[item]});await expect(page.getByRole('button',{name:'New item',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Cucumber',exact:true}).click();await expect(page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Close',exact:true}).click();await nav(page).getByRole('button',{name:'Hub',exact:true}).click();await expect(page.locator('.inventory-bento')).toBeVisible();await expect(page.getByRole('link',{name:/Admin/})).toBeVisible();
});
test('Inventory signs in with the shared app keypad and physical keyboard',async({page})=>{
 await fixture(page,{signin:true,staff:true});await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();await page.getByLabel('Username',{exact:true}).fill('cashier');await page.getByRole('textbox',{name:'6-digit PIN',exact:true}).focus();await page.keyboard.type('483927');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Items',exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('onebite-admin-session')!).token)).toBe(token);
});

test('catalog photos persist with offline changes and remain visible after publishing',async({page,context})=>{
 const server=await fixture(page);await expect(page.locator('.ob-sync')).toHaveAttribute('data-state','complete');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));server.setOnline(false);await context.setOffline(true);
 const dialog=await createMaterial(page,'Photo wrapper');const rgba=Buffer.alloc(64*64*4,255),photo=jpeg.encode({data:rgba,width:64,height:64},75).data;await dialog.locator('input[type="file"]').setInputFiles({name:'wrapper.jpg',mimeType:'image/jpeg',buffer:Buffer.from(photo)});await expect(dialog.locator('.inventory-photo-editor img')).toBeVisible();await dialog.getByRole('button',{name:'Create item',exact:true}).click();await expect(page.locator('.inventory-card-photo')).toBeVisible();await page.reload();await expect(page.locator('.inventory-card-photo')).toBeVisible();server.setOnline(true);await context.setOffline(false);await expect(page.locator('.inventory-card')).not.toContainText('Pending sync');await expect(page.locator('.ob-sync')).toHaveAttribute('data-state','complete');await expect(page.locator('.inventory-card-photo')).toBeVisible();expect(server.items()[0].photoPath).toMatch(/\.jpg$/);
 await context.setOffline(true);server.setOnline(false);await page.reload();await expect(page.locator('.inventory-card-photo')).toBeVisible();
});

test('Owner verification completes before catalog access and resumes queued writes',async({page})=>{
 await fixture(page,{signin:true});let verified=false,requireVerification=false;
 await page.route('**/functions/v1/admin-access',async route=>{const {action}=route.request().postDataJSON();if(action==='login')return route.fulfill({json:{actor,session:token,sessionExpiresAt:Date.now()+3600000,mfaRequired:true,mfaEnrollment:false}});if(action==='mfa.verify'){verified=true;requireVerification=false;return route.fulfill({json:{actor}});}return route.fallback();});
 await page.route('**/functions/v1/inventory-access',async route=>{const {action}=route.request().postDataJSON();if(!verified)return route.fulfill({status:400,json:{error:'mfa_required'}});if(action==='save'&&requireVerification)return route.fulfill({status:400,json:{error:'reauth_required'}});return route.fallback();});
 await page.getByLabel('Username',{exact:true}).fill('owner');await page.getByLabel('6-digit PIN',{exact:true}).fill('483927');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Verify your identity',exact:true})).toBeVisible();await expect(page.locator('.inventory-card')).toHaveCount(0);await page.getByLabel('Verification code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify',exact:true}).click();await expect(page.getByRole('heading',{name:'Items',exact:true})).toBeVisible();await expect(page.locator('.ob-sync')).toHaveAttribute('data-state','complete');
 requireVerification=true;const dialog=await createMaterial(page,'Verified wrapper');await dialog.getByRole('button',{name:'Create item',exact:true}).click();await expect(page.getByRole('heading',{name:'Verify your identity',exact:true})).toBeVisible();await page.getByLabel('Verification code',{exact:true}).fill('654321');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByLabel('Verification code',{exact:true})).toHaveValue('654321');await page.getByRole('button',{name:'Verify',exact:true}).click();await expect(page.locator('.inventory-card')).toContainText('Verified wrapper');await expect(page.locator('.inventory-card')).not.toContainText('Pending sync');
});

 test('catalog dropdowns include management actions and support keyboard selection',async({page})=>{
 await fixture(page);await page.getByRole('button',{name:'New item',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByRole('combobox',{name:'Category'}).click();await page.getByRole('option',{name:'Packaging',exact:true}).click();
 await expect(dialog.getByRole('combobox',{name:'Category'})).toContainText('Packaging');
 await dialog.getByRole('combobox',{name:'Base unit'}).focus();await page.keyboard.press('ArrowDown');await page.getByRole('option',{name:'Millilitres (ml)',exact:true}).click();
 await expect(dialog.getByRole('combobox',{name:'Base unit'})).toContainText('Millilitres (ml)');expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
 });

 test('Inventory Profile shares Admin cards, preferences, photo controls and sign-out',async({page},info)=>{
 await fixture(page);await nav(page).getByRole('button',{name:'Profile',exact:true}).click();await expect(nav(page).getByRole('button',{name:'Account',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'My profile',exact:true})).toBeVisible();await expect(page.locator('.profile-grid .profile-card')).toHaveCount(5);await expect(page.locator('.profile-identity')).toContainText('Inventory Owner');await expect(page.locator('.profile-access')).toContainText('Manage catalog');await expect(page.locator('.profile-session')).toContainText('OneBite - Inventory');
 await page.getByRole('switch',{name:'Dark mode',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.reload();await nav(page).getByRole('button',{name:'Profile',exact:true}).click();await expect(page.getByRole('switch',{name:'Dark mode',exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Add photo',exact:true}).click();const dialog=page.getByRole('dialog');const photo=jpeg.encode({data:Buffer.alloc(64*64*4,255),width:64,height:64},75).data;await dialog.getByLabel('Choose profile photo',{exact:true}).setInputFiles({name:'profile.jpg',mimeType:'image/jpeg',buffer:Buffer.from(photo)});await expect(dialog.getByAltText('Photo preview')).toBeVisible();await dialog.getByRole('button',{name:'Save photo',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.profile-avatar img')).toBeVisible();await expect(page.locator('.ob-profile-badge img')).toBeVisible();await page.reload();await nav(page).getByRole('button',{name:'Profile',exact:true}).click();await expect(page.locator('.profile-avatar img')).toBeVisible();
 await page.getByRole('button',{name:'Change photo',exact:true}).click();await dialog.getByRole('button',{name:'Remove photo',exact:true}).click();await dialog.getByRole('button',{name:'Save photo',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.profile-avatar img')).toHaveCount(0);
 await page.screenshot({path:`artifacts/inventory-profile-${info.project.name}.png`,fullPage:true,animations:'disabled'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.profile-session').getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 });
 test('Staff Profile keeps personal preferences available and disables photo changes offline',async({page,context})=>{
 const server=await fixture(page,{staff:true});await nav(page).getByRole('button',{name:'Profile',exact:true}).click();await expect(page.locator('.profile-security')).toContainText('Personal PIN sign-in');await expect(page.locator('.profile-access').getByText('Denied',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Reset PIN',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Switch language',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','km');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'ប្ដូរភាសា',exact:true}).click();server.setOnline(false);await context.setOffline(true);await expect(page.getByRole('button',{name:'Add photo',exact:true})).toBeDisabled();await page.getByRole('switch',{name:'Dark mode',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 });

test('category filter stays below compact heading and mobile catalog uses rows',async({page})=>{
 const items=Array.from({length:24},(_,index)=>({...newCatalogItem('material'),name:`Wrapper ${String(index).padStart(2,'0')}`,category:index===23?'packaging':'ingredient',unit:'pcs',revision:1}));
 await fixture(page,{items});
 const filter=page.locator('.inventory-category');
 await expect(filter.locator(':scope > span')).toHaveCount(0);
 await expect(filter.getByRole('radiogroup')).toHaveCount(0);
 const packaging=filter.getByRole('button',{name:'Packaging',exact:true});
 await packaging.click();
 await expect(page.locator('.inventory-card')).toHaveCount(1);
 await expect(packaging).toHaveAttribute('aria-pressed','true');
 const all=filter.getByRole('button',{name:'All categories',exact:true});
 await all.click();
 await expect(all).toHaveAttribute('aria-pressed','true');await expect(page.locator('.inventory-card')).toHaveCount(24);
 await expect(filter).toHaveCSS('overflow-x','auto');
 if(page.viewportSize()!.width<=680){
  const rows=page.locator('.inventory-card');
  const first=(await rows.nth(0).boundingBox())!,second=(await rows.nth(1).boundingBox())!;
  expect(first.x).toBe(second.x);expect(second.y).toBeGreaterThanOrEqual(first.y+first.height);
  await expect(rows.first()).toHaveCSS('flex-direction','row');
 }
 await page.evaluate(()=>window.scrollTo({top:600,behavior:'instant'}));
 await expect(page.locator('.ob-page-heading')).toHaveClass(/is-compact/);
 await expect(filter).toBeInViewport();
 await expect.poll(async()=>{
  const heading=(await page.locator('.ob-page-heading').boundingBox())!,category=(await filter.boundingBox())!;
  return Math.abs(category.y-heading.y-heading.height);
 }).toBeLessThan(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('inline reference creation preserves draft and offline references sync before items',async({page,context})=>{
 const server=await fixture(page);await expect(page.locator('.ob-sync')).toHaveAttribute('data-state','complete');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 server.setOnline(false);await context.setOffline(true);
 const item=await createMaterial(page,'Custom flour');
 await item.getByRole('combobox',{name:'Category'}).click();await page.getByRole('option',{name:'+ Add new category',exact:true}).click();
 const category=page.getByRole('dialog',{name:'New category',exact:true});await expect(category.getByRole('switch',{name:'Active'})).toHaveCount(0);
 await category.getByLabel('Name',{exact:true}).fill('Bakery');await category.getByRole('button',{name:'Create',exact:true}).click();
 await expect(item.getByLabel('Name',{exact:true})).toHaveValue('Custom flour');await expect(item.getByRole('combobox',{name:'Category'})).toContainText('Bakery');
 await item.getByRole('combobox',{name:'Base unit'}).click();await page.getByRole('option',{name:'+ Add new base UOM',exact:true}).click();
 const unit=page.getByRole('dialog',{name:'New base UOM',exact:true});await expect(unit.getByRole('switch',{name:'Active'})).toHaveCount(0);
 await unit.getByLabel('Name',{exact:true}).fill('Kilograms');await unit.getByLabel('Unit symbol',{exact:true}).fill('kg');await unit.getByRole('button',{name:'Create',exact:true}).click();
 await expect(item.getByRole('combobox',{name:'Base unit'})).toContainText('Kilograms (kg)');
 await item.getByLabel('Pack name',{exact:true}).fill('Bag');await item.getByLabel('Quantity per pack',{exact:false}).fill('1.5');await item.getByRole('button',{name:'Create item',exact:true}).click();
 await expect(item).toHaveCount(0);await expect(page.locator('.inventory-card')).toContainText('Custom flour');
 await page.reload();await expect(page.locator('.inventory-card')).toContainText('Custom flour');
 await nav(page).getByRole('button',{name:'Changes',exact:true}).click();await expect(page.locator('.inventory-change')).toHaveCount(3);
 await page.evaluate(()=>window.scrollTo({top:500,behavior:'instant'}));
 await expect(page.locator('.ob-app-messages .d-alert-warning')).toBeInViewport();
 server.setOnline(true);await context.setOffline(false);await expect(page.locator('.inventory-change')).toHaveCount(0);expect(server.items()[0].unit).toBe('kg');
 await nav(page).getByRole('button',{name:'Hub',exact:true}).click();await page.getByRole('button',{name:'Base UOMs',exact:false}).click();
 const manager=page.getByRole('dialog',{name:'Base UOMs',exact:true});await manager.getByRole('searchbox',{name:'Search base UOMs'}).fill('Kilograms');await expect(manager.locator('.inventory-reference-row')).toHaveCount(1);await manager.getByRole('button',{name:/Kilograms/}).click();
 const edit=page.getByRole('dialog',{name:'Edit base UOM',exact:true});await expect(edit.getByLabel('Unit symbol')).toBeDisabled();
 await edit.getByRole('switch',{name:'Active'}).click();await page.getByRole('dialog',{name:'Deactivate this record?'}).getByRole('button',{name:'Cancel',exact:true}).click();await expect(edit.getByRole('switch',{name:'Active'})).toBeChecked();
 await edit.getByRole('switch',{name:'Active'}).click();await page.getByRole('dialog',{name:'Deactivate this record?'}).getByRole('button',{name:'Confirm',exact:true}).click();await edit.getByRole('button',{name:'Save changes',exact:true}).click();await manager.getByRole('button',{name:'Status',exact:true}).click();await page.getByRole('menuitemradio',{name:'Inactive',exact:true}).click();await expect(manager.getByRole('button',{name:/Kilograms/})).toContainText('Inactive');
});

async function selectType(page:Page,type:string){await page.getByRole('combobox',{name:'Item type',exact:true}).click();await page.getByRole('option',{name:type,exact:true}).click();}
async function chooseCategory(page:Page){await page.getByRole('combobox',{name:'Category',exact:true}).click();await page.getByRole('option',{name:'Dumplings',exact:true}).click();}
async function selectRecipeItem(page:Page,section:string,index:number,name:string){await page.getByRole('combobox',{name:`${section} item ${index}`,exact:true}).click();await page.getByRole('option',{name,exact:true}).click();}
test('Owner builds a batch component and combines ingredients, contents and packaging',async({page},info)=>{
 const wrapper={...newCatalogItem('material'),name:'Wrapper',revision:1};
 const filling={...newCatalogItem('material'),name:'Filling',unit:'g',revision:1};
 const napkin={...newUnifiedItem(),name:'Napkin',revision:1};napkin.definition!.type='supplies';
 const server=await fixture(page,{items:[wrapper,filling,napkin]});
 await page.getByRole('button',{name:'New item',exact:true}).click();let dialog=page.getByRole('dialog');
 await dialog.getByLabel('Name',{exact:true}).fill('Fried dumpling');await selectType(page,'Component');
 await dialog.getByLabel('Recipe batch output',{exact:true}).fill('10');
 await dialog.getByRole('button',{name:'Add · Ingredients',exact:true}).click();await selectRecipeItem(page,'Ingredients',1,'Wrapper');await dialog.getByLabel('Ingredients quantity 1',{exact:true}).fill('10');
 await dialog.getByRole('button',{name:'Add · Ingredients',exact:true}).click();await selectRecipeItem(page,'Ingredients',2,'Filling');await dialog.getByLabel('Ingredients quantity 2',{exact:true}).fill('30');
 await expect(dialog.getByRole('switch',{name:'Active',exact:true})).toHaveCount(0);await expect(dialog.getByLabel('Master price (KHR)',{exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Create item',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.inventory-grid')).not.toContainText('Pending sync');
 const finished=server.items().find(item=>itemDefinition(item).type==='component')!;expect(finished.definition?.lines).toHaveLength(2);
 await page.getByRole('button',{name:'New item',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Name',{exact:true}).fill('Small dumpling box');await selectType(page,'Finished good');await dialog.getByRole('switch',{name:'Can sell',exact:true}).click();await chooseCategory(page);await dialog.getByLabel('Master price (KHR)',{exact:true}).fill('5000');
 await dialog.getByRole('button',{name:'Add · Items in the box',exact:true}).click();await selectRecipeItem(page,'Items in the box',1,'Fried dumpling');await dialog.getByLabel('Items in the box quantity 1',{exact:true}).fill('5');
 await dialog.getByRole('button',{name:'Add · Packaging used',exact:true}).click();await selectRecipeItem(page,'Packaging used',1,'Napkin');await dialog.getByLabel('Packaging used quantity 1',{exact:true}).fill('2');
 await expect(dialog.locator('.inventory-recipe-summary')).toContainText('15 g');await expect(dialog.locator('.inventory-recipe-summary')).toContainText('5 pcs');await expect(dialog.locator('.inventory-recipe-summary')).toContainText('2 pcs');
 await dialog.getByLabel('Effective from (Cambodia time)',{exact:true}).fill('2026-10-15T09:00');
 await page.screenshot({path:`artifacts/unified-recipe-${info.project.name}.png`,fullPage:true,animations:'disabled'});
 await dialog.getByRole('button',{name:'Create item',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.inventory-grid')).not.toContainText('Pending sync');
 const box=server.items().find(item=>itemDefinition(item).type==='finished_good')!;expect(box.definition?.effectiveAt).toBe('2026-10-15T02:00:00.000Z');expect(box.definition?.lines[0]).toMatchObject({itemId:finished.id,quantity:5,section:'contents'});expect(box.definition?.lines[1].section).toBe('packaging');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('offline component and box recipes survive reload and sync in dependency order',async({page,context})=>{
 const wrapper={...newCatalogItem('material'),name:'Wrapper',revision:1};const server=await fixture(page,{items:[wrapper]});await expect(page.locator('.ob-sync')).toHaveAttribute('data-state','complete');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));server.setOnline(false);await context.setOffline(true);
 await page.getByRole('button',{name:'New item',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Name',{exact:true}).fill('Offline dumpling');await selectType(page,'Component');await dialog.getByRole('button',{name:'Add · Ingredients',exact:true}).click();await dialog.getByRole('button',{name:'Create item',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'New item',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Name',{exact:true}).fill('Offline box');await selectType(page,'Finished good');await dialog.getByRole('switch',{name:'Can sell',exact:true}).click();await chooseCategory(page);await dialog.getByRole('button',{name:'Add · Items in the box',exact:true}).click();await selectRecipeItem(page,'Items in the box',1,'Offline dumpling');await dialog.getByLabel('Items in the box quantity 1',{exact:true}).fill('5');await dialog.getByRole('button',{name:'Create item',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.reload();await expect(page.getByRole('button',{name:'Offline box',exact:true})).toBeVisible();await nav(page).getByRole('button',{name:'Changes',exact:true}).click();await expect(page.locator('.inventory-change')).toHaveCount(2);server.setOnline(true);await context.setOffline(false);await expect(page.getByText('No pending changes',{exact:true})).toBeVisible();
 const finished=server.items().find(item=>itemDefinition(item).type==='component')!;const box=server.items().find(item=>itemDefinition(item).type==='finished_good')!;expect(finished.definition?.lines[0].itemId).toBe(wrapper.id);expect(box.definition?.lines[0]).toMatchObject({itemId:finished.id,quantity:5});expect(server.calls()).toBe(2);
});
