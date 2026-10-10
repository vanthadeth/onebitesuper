import {test,expect} from '@playwright/test';
test('POS has a clean setup screen without sample sales or a browser-only payment flow',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('onebite-pos-preview-v1',JSON.stringify({invoices:[{total:9000}]}));localStorage.setItem('onebite-admin-preview-v1','sample');sessionStorage.setItem('onebite-pos-demo','yes');localStorage.setItem('onebite-language','en');});
 await page.goto('http://127.0.0.1:5173');await expect(page.getByRole('heading',{name:'OneBite - POS'})).toBeVisible();await expect(page.getByText('POS is not ready for sales yet.',{exact:true})).toBeVisible();await expect(page.locator('.product-card')).toHaveCount(0);await expect(page.getByRole('button',{name:'Record payment',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>({pos:localStorage.getItem('onebite-pos-preview-v1'),admin:localStorage.getItem('onebite-admin-preview-v1'),demo:sessionStorage.getItem('onebite-pos-demo')}))).toEqual({pos:null,admin:null,demo:null});
});
