import publicConfig from "../config/supabase.public.json" with { type: "json" };
import {test,expect} from '@playwright/test';
const base=process.env.PAGES_TEST_BASE_URL||'http://127.0.0.1:5185/onebitesuper/';
test('repository-hosted apps have separate install scopes and offline shells',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/functions/v1/admin-access',route=>route.abort());
 await page.goto(base);await expect(page.getByRole('link',{name:/OneBite POS/})).toBeVisible();await page.getByRole('link',{name:/OneBite POS/}).click();
 await expect(page.locator('.product-card')).toHaveCount(6);await expect(page.locator('html')).toHaveAttribute('lang','km');
 const pos=await page.evaluate(async()=>{const link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;return(await fetch(link.href)).json();});
 expect(pos.scope).toBe('/onebitesuper/pos/');expect(pos.start_url).toBe(pos.scope);expect(pos.icons[0].src).toBe('/onebitesuper/pos/icon-192.png');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await page.getByRole('link',{name:'OneBite POS',exact:true}).click();await expect(page).toHaveURL(base+'pos/');
 await context.setOffline(true);await page.reload();await expect(page.locator('.product-card')).toHaveCount(6);await context.setOffline(false);
 await page.goto(base+'admin/');await page.getByRole('button',{name:'បើកសាកល្បងក្នុងឧបករណ៍',exact:true}).click();await expect(page.locator('.access-user-row')).toHaveCount(6);
 const admin=await page.evaluate(async()=>{const link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;return(await fetch(link.href)).json();});
 expect(admin.scope).toBe('/onebitesuper/admin/');expect(admin.id).not.toBe(pos.id);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const scopes=await page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname));expect(scopes.sort()).toEqual(['/onebitesuper/admin/','/onebitesuper/pos/']);
 await page.locator('.access-language').click();await page.getByRole('button',{name:'Add user',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Full name').fill('Pages Tester');await dialog.getByLabel('Username',{exact:true}).fill('pages.tester');await dialog.getByLabel('Role',{exact:true}).click();await page.getByRole('option',{name:'Cashier',exact:true}).click();await dialog.getByRole('button',{name:'Save changes'}).click();
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Open local preview',exact:true}).click();await expect(page.locator('.access-user-row')).toHaveCount(7);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('hosted Admin connects to Supabase and rejects unauthorized account requests',async({page,request})=>{
 test.skip(!process.env.PAGES_TEST_BASE_URL,'Live API checks run from the hosted GitHub verification job.');
 const endpoint=publicConfig.url+'/functions/v1/admin-access';
 const connected=page.waitForResponse(response=>response.url()===endpoint&&response.request().method()==='POST'&&response.request().postDataJSON().action==='bootstrap.status');
 await page.goto(base+'admin/');const response=await connected;expect(response.status()).toBe(200);const data=await response.json();expect(typeof data.ownerCreated).toBe('boolean');
 await expect(page.getByRole('heading',{name:data.ownerCreated?'សូមស្វាគមន៍':'បង្កើតគណនីម្ចាស់',exact:true})).toBeVisible();
 const headers={apikey:publicConfig.publishableKey};
 const noSession=await request.post(endpoint,{headers,data:{action:'me',payload:{}}});expect(noSession.status()).toBe(401);expect(await noSession.json()).toEqual({error:'unauthorized'});
 const badKey=await request.post(endpoint,{headers:{apikey:'invalid'},data:{action:'bootstrap.status',payload:{}}});expect(badKey.status()).toBe(401);
 const direct=await request.post(publicConfig.url+'/rest/v1/rpc/onebite_access_api',{headers,data:{p_action:'bootstrap.status'}});expect([401,403]).toContain(direct.status());
});
