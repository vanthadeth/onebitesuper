import {test,expect,type Page} from '@playwright/test';
import {newUnifiedItem} from '../packages/core/src/inventory';
import {defaultAppSettings} from '../packages/core/src/app-settings';
const owner={id:'11111111-1111-4111-8111-111111111111',name:'Test Owner',username:'owner',role:'Owner',sites:[0],active:true},token='d'.repeat(64);
async function fixture(page:Page,{role='Owner',registered=false,ordering=false}:{role?:string;registered?:boolean;ordering?:boolean}={}){
 const actor={...owner,role},time=new Date().toISOString(),item={...newUnifiedItem(),id:'77777777-7777-4777-8777-777777777777',name:'Test box',nameEn:'Test box',priceKhr:5000,definition:{type:'finished_good',canSell:true,conversion:null,lines:[],effectiveAt:time}};
 let online=true,lose=false,denied=false;let state:any={siteId:0,registered,ordering,generation:registered?1:0,shift:null,custody:null,recentShifts:[],serverTime:time};const calls:any[]=[],receipts=new Map<string,unknown>();
 await page.addInitScript(token=>{localStorage.setItem('onebite-language','en');localStorage.setItem('onebite-admin-session',JSON.stringify({token,expiresAt:Date.now()+86400000}));},token);
 await page.route('**/functions/v1/admin-access',route=>route.fulfill({json:{actor}}));
 await page.route('**/functions/v1/pos-access',async route=>{
  if(!online)return route.abort();const {action,payload}=route.request().postDataJSON();
  if(action==='bootstrap')return route.fulfill({json:{actor,permissions:['pos.access','orders.create','orders.cancel_unpaid','shifts.manage',...(role==='Owner'?['cash.withdraw']:[])],roleName:role,sites:[{id:0,name:'Site A',active:true}],appSettings:defaultAppSettings,versions:[{item,publishedAt:time,effectiveAt:time}],serverTime:time}});
  if(denied)return route.fulfill({status:403,json:{error:'forbidden'}});
  if(action==='workspace')return route.fulfill({json:state});
  calls.push({action,payload});if(receipts.has(payload.requestId))return route.fulfill({json:receipts.get(payload.requestId)});
  if(action==='device.claim'){state={...state,registered:true,ordering:true,generation:state.generation+1};}
  if(action==='device.release'){state={...state,registered:false,ordering:false,generation:state.generation+1};}
  if(action==='shift.open'){state={...state,shift:{id:payload.requestId,openedBy:actor.id,openedAt:time,openingCash:Number(payload.cash),openingSource:payload.source},custody:{holderId:actor.id,holderName:actor.name,cash:Number(payload.cash)}};}
  if(action==='shift.close'){state={...state,recentShifts:[{...state.shift,closedAt:time,countedCash:Number(payload.cash),difference:Number(payload.cash)-state.custody.cash},...state.recentShifts],shift:null,custody:{...state.custody,cash:Number(payload.cash)}};}
  const receipt={requestId:payload.requestId,action,recordedAt:time};receipts.set(payload.requestId,receipt);
  if(lose){lose=false;return route.abort();}return route.fulfill({json:receipt});
 });
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('.pos-order-layout')).toBeVisible();
 return {calls,state:()=>state,offline:()=>{online=false;},lose:()=>{lose=true;},deny:()=>{denied=true;}};
}
async function shift(page:Page){await page.getByRole('button',{name:'Profile menu',exact:true}).click();await page.getByRole('menuitem',{name:'Hub',exact:true}).click();await page.locator('.pos-hub-grid').getByRole('button',{name:'Shift',exact:true}).click();await expect(page.getByRole('heading',{name:'Ordering device',exact:true})).toBeVisible();}
async function register(page:Page){await page.getByRole('button',{name:'Use this device',exact:true}).click();await expect(page.getByRole('button',{name:'Open shift',exact:true})).toBeEnabled();}

test('Owner registers a device, supplies cash, closes with a discrepancy and reuses retained cash',async({page},info)=>{
 const server=await fixture(page);await expect(page.locator('.pos-product').filter({hasText:'Test box'})).toBeDisabled();await shift(page);await register(page);
 await page.getByRole('button',{name:'Open shift',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Open shared shift'});await dialog.getByLabel('Total equivalent KHR').fill('10000');await dialog.getByRole('button',{name:'Confirm & open shift'}).click();await expect(page.getByRole('heading',{name:'Shared shift is open'})).toBeVisible();await expect(page.getByRole('button',{name:'Release device'})).toBeDisabled();await expect(page.locator('.pos-control-grid')).toContainText('10,000');
 await page.getByRole('button',{name:'Close and retain cash'}).click();dialog=page.getByRole('dialog',{name:'Close shift and retain cash'});await dialog.getByLabel('Total equivalent KHR').fill('9000');await dialog.getByRole('button',{name:'Confirm & close shift'}).click();await expect(page.getByRole('heading',{name:'Recently closed shifts'})).toBeVisible();await expect(page.locator('.pos-shift-history')).toContainText('-1,000');
 await page.getByRole('button',{name:'Open shift',exact:true}).click();dialog=page.getByRole('dialog',{name:'Open shared shift'});await expect(dialog.getByLabel('Total equivalent KHR')).toHaveValue('9000');await expect(dialog.getByLabel('Total equivalent KHR')).toHaveAttribute('readonly','');await dialog.getByRole('button',{name:'Confirm & open shift'}).click();await expect(page.getByRole('heading',{name:'Shared shift is open'})).toBeVisible();expect(server.calls.filter(c=>c.action==='shift.open').map(c=>c.payload.source)).toEqual(['supply','retained']);
 await page.screenshot({path:`artifacts/pos-shifts-${info.project.name}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Back to menu'}).click();await expect(page.locator('.pos-product').filter({hasText:'Test box'})).toBeEnabled();
});

test('Cashier cannot enter supplied opening cash; other ordering device prevents registration',async({page})=>{
 await fixture(page,{role:'Cashier'});await shift(page);await register(page);await page.getByRole('button',{name:'Open shift',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Open shared shift'});await expect(dialog.getByLabel('Total equivalent KHR')).toHaveAttribute('readonly','');await expect(dialog).toContainText('zero opening cash');await dialog.getByRole('button',{name:'Confirm & open shift'}).click();await expect(page.getByRole('heading',{name:'Shared shift is open'})).toBeVisible();
 const other=await page.context().newPage();await fixture(other,{registered:true,ordering:false});await shift(other);await expect(other.getByRole('button',{name:'Use this device'})).toHaveCount(0);await expect(other.getByRole('button',{name:'Open shift',exact:true})).toBeDisabled();await expect(other.locator('.pos-control-grid')).toContainText('Another device receives orders');await other.close();
});

test('lost response survives reload and retries the same request ID without creating another shift',async({page})=>{
 const server=await fixture(page);await shift(page);await register(page);server.lose();await page.getByRole('button',{name:'Open shift',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm & open shift'}).click();await expect(page.getByRole('heading',{name:'Request awaiting confirmation'})).toBeVisible();await expect(page.locator('.ob-sync-count')).toHaveText('1');const original=server.calls.find(c=>c.action==='shift.open');await page.reload();await shift(page);await page.getByRole('button',{name:'Retry saved request'}).click();await expect(page.getByRole('heading',{name:'Request awaiting confirmation'})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Shared shift is open'})).toBeVisible();const opens=server.calls.filter(c=>c.action==='shift.open');expect(opens).toHaveLength(2);expect(opens[1].payload).toEqual(original.payload);
});

test('offline allows cached ordering but blocks device/shift changes; denied status cannot fall back to cache',async({page,context})=>{
 const server=await fixture(page);await shift(page);await register(page);await page.getByRole('button',{name:'Open shift',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm & open shift'}).click();await expect(page.getByRole('heading',{name:'Shared shift is open'})).toBeVisible();await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));server.offline();await context.setOffline(true);await page.reload();await expect(page.locator('.pos-product').filter({hasText:'Test box'})).toBeEnabled();await shift(page);await expect(page.getByRole('button',{name:'Close and retain cash'})).toBeDisabled();
});

test('online control denial immediately blocks ordering and never restores old authority offline',async({page,context})=>{
 const server=await fixture(page,{registered:true,ordering:true});await shift(page);await page.getByRole('button',{name:'Open shift',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm & open shift'}).click();await page.getByRole('button',{name:'Back to menu'}).click();await expect(page.locator('.pos-product').filter({hasText:'Test box'})).toBeEnabled();server.deny();await page.locator('.ob-sync').click();await expect(page.locator('.pos-product').filter({hasText:'Test box'})).toBeDisabled();await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));server.offline();await context.setOffline(true);await page.reload();await expect(page.locator('.pos-product').filter({hasText:'Test box'})).toBeDisabled();
});
test('freezing the wall clock cannot extend cached ordering authority offline',async({page,context})=>{
 const server=await fixture(page,{registered:true,ordering:true});await shift(page);await page.getByRole('button',{name:'Open shift',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm & open shift'}).click();await page.getByRole('button',{name:'Back to menu'}).click();await expect(page.locator('.pos-product')).toBeEnabled();server.offline();await context.setOffline(true);await page.evaluate(()=>{const frozen=Date.now();Date.now=()=>frozen;});await expect(page.locator('.pos-product')).toBeDisabled({timeout:19000});
});
