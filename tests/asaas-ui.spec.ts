import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const now = "2026-11-22T18:00:00.000Z";
const receipt = (method: "pix" | "card", status = "pending_payment") => ({
  environment: "sandbox", attemptState: "ready",
  order: { id:"sandbox-ui-order",orderNumber:"TH-SANDBOX-UI",customerAccountId:"synthetic-ui", customerLabel:"Teste Asaas Sandbox",status,channel:"site",paymentProvider:"asaas",paymentMethod:method,providerReference: method === "pix" ? "pay_synthetic" : "checkout_synthetic",checkoutUrl:method === "card" ? "https://sandbox.asaas.com/checkoutSession/show?id=checkout_synthetic" : null,subtotalCents:4990,totalCents:4990,shippingCents:0,discountCents:0,currency:"BRL",isDemo:false,eligibilityStatus:"eligible_demo",stockStatus:status === "paid" ? "committed" : "reserved",stockReservedAt:now,stockReleasedAt:null,expiresAt:now,createdAt:now,updatedAt:now,items:[],history:[{id:"h1",fromStatus:null,toStatus:"pending_payment",reason:"Tentativa Asaas Sandbox registrada.",createdAt:now}] },
  ...(method === "pix" && status === "pending_payment" ? {pix:{encodedImage:"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",payload:"000201-SYNTHETIC-PIX-UI",expirationDate:"2026-11-23 23:59:59"}} : {}),
});

test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(() => {
    localStorage.setItem("th-cart-v1",JSON.stringify({state:{items:[{productId:"case-01",quantity:1,variant:"Preto"}],favorites:[]},version:0}));
  });
  await page.route("**/api/checkout/asaas/config",route => route.fulfill({json:{data:{enabled:true}}}));
  await page.route("**/api/auth/login",route => route.fulfill({json:{data:{id:"synthetic-ui",name:"Cliente Sintético",email:"synthetic@example.test",phone:"",city:"",state:"",createdAt:now}}}));
});

async function enterCheckout(page: Page, ageGate = true) {
  await page.goto("/conta/entrar");
  if (ageGate) await page.getByRole("button",{name:"Sim, tenho 18+"}).click();
  await page.getByLabel("E-mail",{exact:true}).fill("synthetic@example.test");
  await page.getByLabel("Senha",{exact:true}).fill("Synthetic123");
  await page.getByRole("button",{name:"Entrar",exact:true}).click();
  await expect(page).toHaveURL(/\/conta$/);
  await page.getByRole("button",{name:/Abrir carrinho/}).click();
  await page.getByRole("link",{name:/Finalizar pedido/}).click();
  await expect(page).toHaveURL(/\/checkout$/);
}

test("Sandbox Pix checkout keeps demo default, displays dynamic QR/code, reconciles and restores attempt",async ({page},info) => {
  let posts=0;let queries=0;
  await page.route("**/api/checkout/asaas", async route => {posts++;expect(route.request().postDataJSON()).toMatchObject({paymentMethod:"pix",items:[{productId:"case-01",quantity:1,variant:"Preto"}]});await route.fulfill({json:{data:receipt("pix")}});});
  await page.route("**/api/checkout/asaas/sandbox-ui-order", route => {queries++;return route.fulfill({json:{data:receipt("pix",queries>1 ? "paid" : "pending_payment")}});});
  await enterCheckout(page);
  await expect(page.getByText("Checkout demonstrativo. Nenhuma cobrança será realizada.",{exact:false})).toBeVisible();
  await page.getByLabel("Usar Asaas Sandbox (teste sintético)").check();
  await page.getByRole("button",{name:"Criar pedido Asaas Sandbox"}).click();
  await expect(page.getByRole("img",{name:"QR Code Pix dinâmico do pedido de teste Sandbox"})).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Pix Copia e Cola"})).toHaveValue("000201-SYNTHETIC-PIX-UI");
  expect((await new AxeBuilder({page}).include('[aria-label="Asaas Sandbox"]').analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`.preview-validation/asaas-pix-${info.project.name}.png`,fullPage:true});
  await page.getByRole("button",{name:"Consultar e reconciliar pedido"}).click();
  await enterCheckout(page,false);await page.getByLabel("Usar Asaas Sandbox (teste sintético)").check();
  await expect(page.getByText("Pago · R$ 49,90")).toBeVisible();expect(posts).toBe(1);
  const storage=await page.evaluate(() => sessionStorage.getItem("th-asaas-sandbox-attempt"));expect(storage).toContain("sandbox-ui-order");expect(storage).not.toContain("synthetic@example.test");
});

test("Sandbox card opens only hosted sandbox, with no card fields or charge from callback",async ({page},info) => {
  let posts=0;
  await page.route("**/api/checkout/asaas",route => {posts++;return route.fulfill({json:{data:receipt("card")}});});
  await page.route("**/api/checkout/asaas/sandbox-ui-order",route => route.fulfill({json:{data:receipt("card")}}));
  await enterCheckout(page);
  await page.getByLabel("Usar Asaas Sandbox (teste sintético)").check();await page.getByLabel("Cartão hospedado Sandbox").check();
  await page.getByRole("button",{name:"Criar pedido Asaas Sandbox"}).click();
  await expect(page.getByRole("link",{name:"Abrir cartão no Asaas Sandbox"})).toHaveAttribute("href",/^https:\/\/sandbox\.asaas\.com\/checkoutSession\/show\?id=/);
  await expect(page.locator('input[autocomplete="cc-number"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`.preview-validation/asaas-card-${info.project.name}.png`,fullPage:true});
  await page.goto("/checkout?asaasOrder=sandbox-ui-order");
  await expect(page.getByRole("link",{name:"Entre com sua conta de teste"})).toBeVisible();expect(posts).toBe(1);
  await enterCheckout(page,false);await page.getByLabel("Usar Asaas Sandbox (teste sintético)").check();
  await expect(page.getByText("Aguardando pagamento · R$ 49,90")).toBeVisible();expect(posts).toBe(1);
});

test("Sandbox admin dashboard separates test totals, stock/history and authenticated reconciliation",async ({page},info) => {
  await page.route("**/api/admin/auth/session",route=>route.fulfill({json:{data:{id:"synthetic-admin",name:"Admin Sintético",email:"admin@example.test",role:"admin"}}}));
  let reconciled=false;
  await page.route("**/api/admin/asaas",route=>route.fulfill({json:{data:{environment:"sandbox",notice:"Testes sintéticos sem receita real",summary:[{status:"paid",count:1,total_cents:"4990"}],attempts:[{id:"sandbox-ui-order",order_number:"TH-SANDBOX-UI",status:"paid",total_cents:4990,stock_status:"committed",state:"ready",last_provider_status:"CONFIRMED",updated_at:now}],history:[{order_id:"sandbox-ui-order",from_status:"pending_payment",to_status:"paid",reason:"Estado confirmado pelo Asaas Sandbox.",created_at:now}]}}}));
  await page.route("**/api/admin/asaas/reconcile",route=>{reconciled=true;expect(route.request().postDataJSON()).toEqual({orderId:"sandbox-ui-order"});return route.fulfill({json:{data:receipt("pix","paid")}});});
  await page.goto("/admin/asaas");
  await expect(page.getByRole("heading",{name:"Asaas Sandbox",exact:true})).toBeVisible();
  await expect(page.getByText("1 pedido de teste",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Reconciliar pedido",exact:true}).click();expect(reconciled).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`.preview-validation/asaas-dashboard-${info.project.name}.png`,fullPage:true});
});
