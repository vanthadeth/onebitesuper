import publicConfig from "../config/supabase.public.json" with { type: "json" };
import {test,expect} from '@playwright/test';
const base=process.env.PAGES_TEST_BASE_URL||'http://127.0.0.1:5185/onebitesuper/';
test('repository-hosted apps have separate install scopes and clean offline shells',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/functions/v1/admin-access',route=>route.abort());
 await page.goto(base);await page.getByRole('link',{name:/OneBite POS/}).click();await expect(page.getByRole('heading',{name:'OneBite - POS'})).toBeVisible();await expect(page.locator('.product-card')).toHaveCount(0);
 const pos=await page.evaluate(async()=>{const link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;return(await fetch(link.href)).json();});expect(pos.scope).toBe('/onebitesuper/pos/');expect(pos.start_url).toBe(pos.scope);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'OneBite - POS'})).toBeVisible();await context.setOffline(false);
 await page.goto(base+'admin/');await expect(page.getByRole('button',{name:'ព្យាយាមភ្ជាប់ម្តងទៀត',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'បើកសាកល្បងក្នុងឧបករណ៍',exact:true})).toHaveCount(0);await expect(page.locator('.access-user-row')).toHaveCount(0);
 const admin=await page.evaluate(async()=>{const link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;return(await fetch(link.href)).json();});expect(admin.scope).toBe('/onebitesuper/admin/');expect(admin.id).not.toBe(pos.id);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));const scopes=await page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname));expect(scopes.sort()).toEqual(['/onebitesuper/admin/','/onebitesuper/pos/']);expect(errors).toEqual([]);
});

test('hosted Admin connects to Supabase and rejects unauthorized account requests',async({page,request})=>{
 test.skip(!process.env.PAGES_TEST_BASE_URL,'Live API checks run from the hosted GitHub verification job.');
 const endpoint=publicConfig.url+'/functions/v1/admin-access';
 const connected=page.waitForResponse(response=>response.url()===endpoint&&response.request().method()==='POST'&&response.request().postDataJSON().action==='bootstrap.status');
 await page.goto(base+'admin/');const response=await connected;expect(response.status()).toBe(200);const data=await response.json();expect(typeof data.ownerCreated).toBe('boolean');expect(typeof data.appSettings.geofenceRadiusM).toBe('number');expect(typeof data.appSettings.exchangeRate).toBe('number');
 await expect(page.getByRole('heading',{name:data.ownerCreated?'សូមស្វាគមន៍':'បង្កើតគណនីម្ចាស់',exact:true})).toBeVisible();
 const headers={apikey:publicConfig.publishableKey};
 const noSession=await request.post(endpoint,{headers,data:{action:'me',payload:{}}});expect(noSession.status()).toBe(401);expect(await noSession.json()).toEqual({error:'unauthorized'});
 const roleRequest=await request.post(endpoint,{headers:{...headers,Authorization:'Bearer '+'0'.repeat(64)},data:{action:'role.create',payload:{}}});expect(roleRequest.status()).toBe(401);expect(await roleRequest.json()).toEqual({error:'unauthorized'});
 for(const action of ['site.create','site.update','site.photo.upload','settings.update','activity.list']){const denied=await request.post(endpoint,{headers,data:{action,payload:{}}});expect(denied.status()).toBe(401);expect(await denied.json()).toEqual({error:'unauthorized'});}
 const badKey=await request.post(endpoint,{headers:{apikey:'invalid'},data:{action:'bootstrap.status',payload:{}}});expect(badKey.status()).toBe(401);
 const direct=await request.post(publicConfig.url+'/rest/v1/rpc/onebite_access_api',{headers,data:{p_action:'bootstrap.status'}});expect([401,403]).toContain(direct.status());
});

test('repository-hosted SQLite cache restores real-server-shaped data after a fully offline reload',async({page,context})=>{
 const {initialAccessState}=await import('./fixtures/access');const snapshot={...initialAccessState(),customRoles:[],revision:1};
 await page.addInitScript(()=>{localStorage.setItem('onebite-language','en');localStorage.setItem('onebite-admin-session',JSON.stringify({token:'a'.repeat(64),expiresAt:Date.now()+3600000}));});
 await page.route('**/functions/v1/admin-access',route=>route.fulfill({json:{actor:snapshot.users[0],state:snapshot}}));
 await page.goto(base+'admin/');await expect(page.locator('.access-user-row')).toHaveCount(6);
 const mobile=page.viewportSize()!.width<680,nav=page.locator(mobile?'.access-bottom-nav':'.access-sidebar nav');
 for(const name of [mobile?'Sites':'Site','Roles','Users']){
  await nav.getByRole('button',{name,exact:true}).click();const tools=page.locator('.ob-directory-tools');await expect(tools).toBeVisible();await expect(tools).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(tools.getByRole('searchbox')).toBeVisible();await expect(tools.getByRole('group').first()).toBeVisible();
 }
 await page.locator('.access-main').evaluate(element=>{element.style.minHeight='2000px';});await page.evaluate(()=>window.scrollTo({top:400,behavior:'instant'}));await expect(page.locator('.ob-directory-tools')).toHaveClass(/is-scroll-hidden/);await expect(page.locator('.ob-page-heading')).toBeVisible();expect((await page.locator('.ob-page-heading').boundingBox())!.y).toBeGreaterThanOrEqual(71);expect((await page.locator('.ob-page-heading').boundingBox())!.y).toBeLessThan(74);await expect(page.getByRole('button',{name:'Create new user',exact:true})).toBeVisible();await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await expect(page.locator('.ob-directory-tools')).not.toHaveClass(/is-scroll-hidden/);await page.locator('.access-main').evaluate(element=>{element.style.minHeight='';});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await page.unroute('**/functions/v1/admin-access');
 await context.setOffline(true);await page.reload();await expect(page.locator('.access-offline-notice')).toContainText('View saved data. Reconnect to make changes.');await expect(page.locator('.access-user-row')).toHaveCount(6);await expect(page.getByRole('button',{name:'Create new user',exact:true})).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.setOffline(false);
});
