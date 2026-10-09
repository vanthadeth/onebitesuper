import { test, expect, type Page } from "@playwright/test";

test('independent PWA manifests and offline shell preserve a sample cart',async({page,context})=>{
 await page.goto('http://127.0.0.1:5173');
 const posManifest=await page.evaluate(async()=>{const response=await fetch('/manifest.webmanifest');return response.json();});
 expect(posManifest.id).toBe('/onebite-pos');expect(posManifest.display).toBe('standalone');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await addItem(page);
 await context.setOffline(true);await page.reload();await expect(page.locator('.product-card')).toHaveCount(6);expect(await page.evaluate(async()=>{try{await fetch('/connection-check',{cache:'no-store'});return false;}catch{return true;}})).toBe(true);
 await showCart(page);await expect(page.getByRole('button',{name:'Review & pay',exact:true}).filter({visible:true})).toBeVisible();
 await context.setOffline(false);await page.goto('http://127.0.0.1:5174');
 const adminManifest=await page.evaluate(async()=>{const response=await fetch('/manifest.webmanifest');return response.json();});expect(adminManifest.id).toBe('/onebite-admin');expect(adminManifest.id).not.toBe(posManifest.id);
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("onebite-language", "en"),
  );
});
async function addItem(page: Page, index = 0) {
  await page.locator(".product-card").nth(index).click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
}
async function showCart(page: Page) {
  const mobile = page.getByRole("button", { name: /View cart/ });
  if (await mobile.isVisible()) await mobile.click();
}

test("holds the current cart before browsing held carts, resumes and pays without duplicates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5173");
  await addItem(page);
  await page.getByRole("button", { name: /Held carts/ }).click();
  await expect(
    page.getByRole("dialog").getByText("1 items · 5,000៛"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await addItem(page, 4);
  await page.getByRole("button", { name: /Held carts/ }).click();
  await expect(page.locator(".held-row")).toHaveCount(2);
  await page.locator(".held-resume").filter({ hasText: "5,000៛" }).click();
  await expect(
    page
      .getByRole("button", { name: "Review & pay", exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review & pay", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(
    page.locator(".list-card").filter({ hasText: "Paid" }),
  ).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(
    page.locator(".list-card").filter({ hasText: "Paid" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: /Held carts/ }).click();
  await expect(page.locator(".held-row")).toHaveCount(1);
  await expect(page.getByText("1 items · 4,000៛")).toBeVisible();
  expect(errors).toEqual([]);
});

test("free boxes reserve base units; insufficient selection blocks and cancellation restores them", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5173");
  await page.locator(".product-card").nth(1).click();
  await page.getByLabel("Increase quantity").click();
  await page.getByLabel("Increase quantity").click();
  await page.locator("summary").click();
  await page
    .getByRole("switch", { name: "Complimentary, including all extras" })
    .click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("button", { name: /Held carts/ }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator(".product-card").first().click();
  await page.locator("summary").click();
  await page
    .getByRole("switch", { name: "Complimentary, including all extras" })
    .click();
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Remaining: 0/)).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: /Held carts/ }).click();
  await page.getByRole("button", { name: "Cancel held invoice" }).click();
  await page
    .getByRole("textbox", { name: "Reason", exact: true })
    .fill("Customer left");
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator(".product-card").first().click();
  await page.locator("summary").click();
  await page
    .getByRole("switch", { name: "Complimentary, including all extras" })
    .click();
  await expect(page.getByText(/Remaining: 30/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toBeEnabled();
});

test("split payments total the invoice and withdrawals require both confirmations", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("switch", { name: "Allow Cash / QR split payments" })
    .click();
  await page.getByRole("button", { name: "Sell", exact: true }).click();
  await addItem(page);
  await showCart(page);
  await page
    .getByRole("button", { name: "Review & pay", exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.getByRole("spinbutton").fill("2000");
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await page.getByRole("button", { name: "Shift", exact: true }).click();
  await expect(
    page.locator(".stat").filter({ hasText: "Cash sales" }),
  ).toContainText("2,000៛");
  await expect(
    page.locator(".stat").filter({ hasText: "QR Payment" }),
  ).toContainText("3,000៛");
  await page.getByRole("button", { name: "Preview withdrawal" }).click();
  await page.getByRole("spinbutton").fill("1000");
  await page.getByRole("textbox").fill("Collection");
  const submit = page.getByRole("button", { name: "Record sample withdrawal" });
  await expect(submit).toBeDisabled();
  await page
    .getByRole("switch", { name: "Dara · Owner · confirms withdrawal" })
    .click();
  await expect(submit).toBeDisabled();
  await page
    .getByRole("switch", { name: "Sokha · Cash holder · confirms cash given" })
    .click();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator(".shift-hero")).toContainText("101,000៛");
});

test("Khmer is default and both views fit the viewport", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("onebite-language"));
  await page.goto("http://127.0.0.1:5173");
  await expect(page.locator("html")).toHaveAttribute("lang", "km");
  await expect(page.locator(".product-card")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("http://127.0.0.1:5174");
  await expect(page.locator("html")).toHaveAttribute("lang", "km");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('empty POS views guide ordering and filtered menus recover',async({page})=>{
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Invoices',exact:true}).click();await page.locator('.ob-empty-state').getByRole('button',{name:'Take an order',exact:true}).click();await expect(page.locator('.product-card')).toHaveCount(6);
 await page.getByPlaceholder('Search the menu…').fill('no-such-bite');await page.locator('.ob-empty-state').getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.locator('.product-card')).toHaveCount(6);
 await page.getByRole('button',{name:/Held carts/}).click();await page.getByRole('dialog').getByRole('button',{name:'Browse menu',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.product-card').first()).toBeFocused();
});

test('shared defaults apply currency, exchange rate and QR payment while preserving personal language',async({page})=>{
 const {defaultAppSettings}=await import('../packages/core/src/app-settings');await page.route('**/functions/v1/admin-access',route=>route.fulfill({json:{ownerCreated:true,appSettings:{...defaultAppSettings,defaultLanguage:'km',defaultTheme:'dark',defaultCurrency:'USD',defaultPaymentMethod:'qr',exchangeRate:5000}}}));await page.goto('http://127.0.0.1:5173');await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('.product-card').first()).toContainText('$1.00');await addItem(page);await showCart(page);await page.getByRole('button',{name:'Review & pay',exact:true}).filter({visible:true}).click();const dialog=page.getByRole('dialog').last();await expect(dialog.locator('.payment-total')).toContainText('$1.00');await expect(dialog.getByRole('button',{name:'QR Payment',exact:true})).toHaveClass(/selected/);await page.getByRole('button',{name:'Confirm payment',exact:true}).click();await page.getByRole('button',{name:'Shift',exact:true}).click();await expect(page.locator('.stat').filter({hasText:'QR Payment'})).toContainText('$1.00');
});

test('new devices use the default language and cached preferences remain available offline',async({page,context})=>{
 const {defaultAppSettings}=await import('../packages/core/src/app-settings');await page.addInitScript(()=>localStorage.removeItem('onebite-language'));await page.route('**/functions/v1/admin-access',route=>route.fulfill({json:{ownerCreated:true,appSettings:{...defaultAppSettings,defaultLanguage:'en',defaultTheme:'dark'}}}));await page.goto('http://127.0.0.1:5173');await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.evaluate(async()=>{localStorage.setItem('onebite-theme','light');await navigator.serviceWorker.ready;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await context.setOffline(true);await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.locator('.product-card')).toHaveCount(6);
});
