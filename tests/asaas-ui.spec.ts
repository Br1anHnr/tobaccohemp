import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const now = "2026-11-22T18:00:00.000Z";
const syntheticAccount = {
  id: "synthetic-ui",
  name: "Cliente Sintético",
  email: "synthetic@example.test",
  phone: "11999990000",
  city: "",
  state: "",
  addresses: [],
  createdAt: now,
};
const receipt = (method: "pix" | "card", status = "pending_payment", attemptState = "ready") => ({
  environment: "sandbox",
  attemptState,
  order: {
    id: "sandbox-ui-order",
    orderNumber: "TH-SANDBOX-UI",
    customerAccountId: "synthetic-ui",
    customerLabel: "Teste Asaas Sandbox",
    status,
    channel: "site",
    paymentProvider: "asaas",
    paymentMethod: method,
    providerReference: method === "pix" ? "pay_synthetic" : "checkout_synthetic",
    checkoutUrl: method === "card" ? "https://sandbox.asaas.com/checkoutSession/show?id=checkout_synthetic" : null,
    subtotalCents: 4990,
    totalCents: 4990,
    shippingCents: 0,
    discountCents: 0,
    currency: "BRL",
    isDemo: false,
    eligibilityStatus: "eligible_demo",
    stockStatus: status === "paid" ? "committed" : status === "canceled" || status === "expired" ? "released" : "reserved",
    stockReservedAt: now,
    stockReleasedAt: null,
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: "item-1",
        orderId: "sandbox-ui-order",
        productId: "case-01",
        sku: "TH-CASE-01",
        productName: "Case Compact Preto",
        categorySlug: "cases",
        variant: "Preto",
        quantity: 1,
        unitPriceCents: 4990,
        lineTotalCents: 4990,
        eligible: true,
      },
    ],
    history: [
      {
        id: "h1",
        fromStatus: null,
        toStatus: "pending_payment",
        reason: "Tentativa Asaas Sandbox registrada.",
        createdAt: now,
      },
    ],
  },
  ...(method === "pix" && status === "pending_payment" && attemptState === "ready"
    ? {
        pix: {
          encodedImage: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          payload: "000201-SYNTHETIC-PIX-UI",
          expirationDate: "2026-11-23 23:59:59",
        },
      }
    : {}),
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "th-cart-v1",
      JSON.stringify({
        state: { items: [{ productId: "case-01", quantity: 1, variant: "Preto" }], favorites: [] },
        version: 0,
      }),
    );
  });
  await page.route("**/api/checkout/asaas/config", (route) => route.fulfill({ json: { data: { enabled: true, mode: "preview_sandbox" } } }));
  await page.route("**/api/auth/addresses", (route) => route.fulfill({ json: { data: syntheticAccount.addresses } }));
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      json: {
        data: syntheticAccount,
      },
    }),
  );
  await page.route("**/api/auth/orders", (route) => route.fulfill({ json: { data: [] } }));
});

async function enterCheckout(page: Page, ageGate = true) {
  await page.goto("/conta/entrar");
  if (ageGate) await page.getByRole("button", { name: "Sim, tenho 18+" }).click();
  await page.getByLabel("E-mail", { exact: true }).fill("synthetic@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Synthetic123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await page.getByRole("button", { name: /Abrir carrinho/ }).click();
  await page.getByRole("link", { name: /Finalizar pedido/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);
}

test("Sandbox Pix checkout keeps demo default, displays dynamic QR/code, clears cart, reconciles and restores attempt", async ({ page }, info) => {
  let posts = 0;
  let queries = 0;
  await page.route("**/api/checkout/asaas", async (route) => {
    posts++;
    expect(route.request().postDataJSON()).toMatchObject({
      paymentMethod: "pix",
      items: [{ productId: "case-01", quantity: 1, variant: "Preto" }],
    });
    await route.fulfill({ json: { data: receipt("pix") } });
  });
  await page.route("**/api/checkout/asaas/sandbox-ui-order", (route) => {
    queries++;
    return route.fulfill({ json: { data: receipt("pix", queries > 0 ? "paid" : "pending_payment") } });
  });
  await enterCheckout(page);
  await expect(page.getByText("Ambiente de homologação — cobranças reais estão desabilitadas neste Preview.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Finalizar pedido" }).click();
  await expect(page.getByRole("img", { name: "QR Code Pix do pedido" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Pix Copia e Cola" })).toHaveValue("000201-SYNTHETIC-PIX-UI");
  await expect(page.getByText("1 × Case Compact Preto · Preto").first()).toBeVisible();

  const cartAfterCreate = await page.evaluate(() => localStorage.getItem("th-cart-v1") ?? "");
  expect(JSON.parse(cartAfterCreate).state.items).toEqual([]);

  expect((await new AxeBuilder({ page }).include('[aria-label="Pagamento do pedido"]').analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `.preview-validation/asaas-pix-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Atualizar status do pedido" }).click();
  await expect(page.getByText("Pago · R$ 49,90")).toBeVisible();
  await page.getByRole("link", { name: "Ver em Meus pedidos" }).click();
  await expect(page).toHaveURL(/\/conta\/pedidos$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText("Pago · R$ 49,90")).toBeVisible();
  expect(posts).toBe(1);
  const storage = await page.evaluate(() => sessionStorage.getItem("th-asaas-sandbox-attempt"));
  expect(storage).toContain("sandbox-ui-order");
  expect(storage).not.toContain("synthetic@example.test");
});

test("Sandbox checkout resets on expired/uncertain and clears stale 404 sessionStorage handle", async ({ page }) => {
  await page.route("**/api/checkout/asaas", (route) =>
    route.fulfill({ json: { data: receipt("pix", "pending_payment", "uncertain") } }),
  );
  await page.route("**/api/checkout/asaas/sandbox-ui-order", (route) =>
    route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "Pedido não encontrado." } } }),
  );
  await enterCheckout(page);
  await page.getByRole("button", { name: "Finalizar pedido" }).click();
  await expect(page.getByRole("button", { name: "Fazer novo pedido" })).toBeVisible();
  await page.getByRole("button", { name: "Atualizar status do pedido" }).click();
  await expect(page.getByText("Pedido anterior não encontrado nesta conta.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("th-asaas-sandbox-attempt"))).toBeNull();
  await expect(page.getByRole("link", { name: "Explorar a loja" })).toBeVisible();
});

test("allowlisted customer returns from hosted checkout, sees persisted outcome and starts another order", async ({ page }, info) => {
  const delivery = {
    id: "synthetic-address", label: "Casa", zip: "12500000", street: "Rua Sintética",
    number: "10", complement: "", city: "Guaratinguetá", state: "SP", isDefault: true, updatedAt: now,
  };
  const signedIn = { ...syntheticAccount, addresses: [delivery] };
  await page.route("**/api/auth/session", route => route.fulfill({ json: { data: signedIn } }));
  await page.route("**/api/auth/login", route => route.fulfill({ json: { data: signedIn } }));
  await page.route("**/api/auth/addresses", route => route.fulfill({ json: { data: [delivery] } }));
  await page.route("**/api/checkout/asaas/config", route => route.fulfill({ json: { data: { enabled: true, mode: "customer_sandbox" } } }));
  await page.route("**/api/admin/asaas/**", route => route.fulfill({ status: 401 }));
  let posts = 0;
  const response = (status: string) => {
    const data = receipt("card", status);
    return {
      ...data, order: { ...data.order, id: `sandbox-customer-${posts}`, orderNumber: `TH-TEST-${posts}` },
      checkoutDetails: { delivery },
    };
  };
  await page.route("**/api/checkout/asaas", async route => {
    posts++;
    expect(route.request().postDataJSON()).toMatchObject({
      contact: { name: posts === 1 ? "Cliente Editado" : signedIn.name, email: signedIn.email },
      delivery: { street: delivery.street, zip: delivery.zip },
    });
    await route.fulfill({ json: { data: response("pending_payment") } });
  });
  let shopOrigin = "";
  await page.route("https://sandbox.asaas.com/checkoutSession/show?**", route => route.fulfill({
    status: 302, headers: { location: `${shopOrigin}/pedido-confirmado?asaasOrder=sandbox-customer-${posts}` },
  }));
  await page.route("**/api/checkout/asaas/sandbox-customer-*", route =>
    route.fulfill({ json: { data: response("paid") } }),
  );
  await enterCheckout(page);
  shopOrigin = new URL(page.url()).origin;
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Nome completo").fill("Cliente Editado");
  await page.getByRole("radio", { name: /Cartão de crédito/ }).check();
  await page.getByRole("button", { name: "Finalizar pedido" }).click();
  await expect(page).toHaveURL(/pedido-confirmado\?asaasOrder=sandbox-customer-1$/);
  await expect(page.getByRole("heading", { name: "Pedido TH-TEST-1" })).toBeVisible();
  await expect(page.getByText("Pago · R$ 49,90")).toBeVisible();
  await expect(page.getByText(/Rua Sintética, 10/)).toBeVisible();
  await expect(page.getByText("Tentativa Asaas Sandbox registrada.")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `.preview-validation/customer-confirmation-${info.project.name}.png`, fullPage: true });
  await enterCheckout(page, false);
  await expect(page.getByText(signedIn.name, { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /Cartão de crédito/ }).check();
  await page.getByRole("button", { name: "Finalizar pedido" }).click();
  await expect(page.getByRole("heading", { name: "Pedido TH-TEST-2" })).toBeVisible();
  expect(posts).toBe(2);
});

test("Sandbox card opens only hosted sandbox, with no card fields or charge from callback", async ({ page }, info) => {
  let posts = 0;
  await page.route("**/api/checkout/asaas", (route) => {
    posts++;
    return route.fulfill({ json: { data: receipt("card") } });
  });
  await page.route("**/api/checkout/asaas/sandbox-ui-order", (route) =>
    route.fulfill({ json: { data: receipt("card") } }),
  );
  await enterCheckout(page);
  await page.locator("#asaas-method-card").check();
  await page.getByRole("button", { name: "Finalizar pedido" }).click();
  await expect(page.getByRole("link", { name: "Pagar com cartão" })).toHaveAttribute(
    "href",
    /^https:\/\/sandbox\.asaas\.com\/checkoutSession\/show\?id=/,
  );
  await expect(page.locator('input[autocomplete="cc-number"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `.preview-validation/asaas-card-${info.project.name}.png`, fullPage: true });
  await page.goto("/checkout?asaasOrder=sandbox-ui-order");
  await expect(page.getByRole("link", { name: "Entrar na conta" })).toBeVisible();
  expect(posts).toBe(1);
});

test("Authenticated customer order history shows persisted orders and accesses checkout link", async ({ page }) => {
  const realOrder = {
    ...receipt("pix", "paid").order,
    history: [
      { id: "h1", orderId: "sandbox-ui-order", fromStatus: null, toStatus: "draft", reason: "Pedido criado.", actorType: "customer", actorId: "synthetic-ui", createdAt: now },
      { id: "h2", orderId: "sandbox-ui-order", fromStatus: "pending_payment", toStatus: "paid", reason: "Estado confirmado pelo Asaas Sandbox.", actorType: "provider_webhook", actorId: "asaas-sandbox", createdAt: now },
    ],
  };
  await page.route("**/api/auth/orders", (route) => route.fulfill({ json: { data: [realOrder] } }));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { data: syntheticAccount } }));
  await page.goto("/conta/entrar");
  await page.getByRole("button", { name: "Sim, tenho 18+" }).click();
  await page.getByLabel("E-mail", { exact: true }).fill("synthetic@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Synthetic123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole("heading", { name: "TH-SANDBOX-UI" })).toBeVisible();
  await page.goto("/conta/pedidos");
  await expect(page.getByRole("heading", { name: "TH-SANDBOX-UI" })).toBeVisible();
  await expect(page.getByText("Asaas Sandbox · teste sintético")).toBeVisible();
  await expect(page.getByRole("link", { name: "Consultar no checkout" })).toHaveAttribute("href", "/checkout?asaasOrder=sandbox-ui-order");
});

test("Customer order history distinguishes an unavailable API from an empty account", async ({ page }) => {
  let available = false;
  await page.route("**/api/auth/session", route => route.fulfill({ json: { data: syntheticAccount } }));
  await page.route("**/api/auth/orders", route => available
    ? route.fulfill({ json: { data: [] } })
    : route.fulfill({ status: 503, json: { error: { message: "Serviço indisponível" } } }));

  await page.goto("/conta/entrar");
  await page.getByRole("button", { name: "Sim, tenho 18+" }).click();
  await page.getByLabel("E-mail", { exact: true }).fill("synthetic@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Synthetic123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const orderAlert = page.getByRole("alert").filter({ hasText: "Não foi possível carregar seus pedidos." });
  await expect(orderAlert).toBeVisible();
  await page.getByRole("link", { name: "Meus pedidos" }).click();
  await expect(page).toHaveURL(/\/conta\/pedidos$/);
  await expect(orderAlert).toBeVisible();
  await expect(page.getByText("Você ainda não possui pedidos registrados nesta conta.")).toHaveCount(0);
  const retry = page.getByRole("button", { name: "Tentar novamente" });
  await expect(retry).toBeVisible();
  available = true;
  await retry.click();
  await expect(page.getByText("Você ainda não possui pedidos registrados nesta conta.")).toBeVisible();
});

test("Sandbox admin dashboard separates test totals, stock/history, diagnostics and authenticated reconciliation/cancel", async ({ page }, info) => {
  await page.route("**/api/admin/auth/session", (route) =>
    route.fulfill({ json: { data: { id: "synthetic-admin", name: "Admin Sintético", email: "admin@example.test", role: "admin" } } }),
  );
  let reconciled = false;
  let canceled = false;
  await page.route("**/api/admin/asaas", (route) =>
    route.fulfill({
      json: {
        data: {
          environment: "sandbox",
          notice: "Testes sintéticos sem receita real",
          summary: [{ status: "pending_payment", count: 1, total_cents: "4990" }],
          attempts: [
            {
              id: "sandbox-ui-order",
              order_number: "TH-SANDBOX-UI",
              status: "pending_payment",
              payment_method: "pix",
              total_cents: 4990,
              stock_status: "reserved",
              state: "ready",
              last_provider_status: "PENDING",
              last_error_code: "invalid_action",
              last_error_status: 400,
              last_error_at: now,
              updated_at: now,
            },
          ],
          history: [
            {
              order_id: "sandbox-ui-order",
              order_number: "TH-SANDBOX-UI",
              from_status: "draft",
              to_status: "pending_payment",
              reason: "Tentativa Asaas Sandbox registrada.",
              created_at: now,
            },
          ],
        },
      },
    }),
  );
  await page.route("**/api/admin/asaas/reconcile", (route) => {
    reconciled = true;
    expect(route.request().postDataJSON()).toEqual({ orderId: "sandbox-ui-order" });
    return route.fulfill({ json: { data: receipt("pix", "paid") } });
  });
  await page.route("**/api/admin/asaas/cancel", (route) => {
    canceled = true;
    expect(route.request().postDataJSON()).toEqual({ orderId: "sandbox-ui-order" });
    return route.fulfill({ json: { data: { order: receipt("pix", "canceled").order } } });
  });
  await page.goto("/admin/asaas");
  await expect(page.getByRole("heading", { name: "Asaas Sandbox", exact: true })).toBeVisible();
  await expect(page.getByText("1 pedido de teste", { exact: true })).toBeVisible();
  await expect(page.getByText("Último diagnóstico: invalid_action (HTTP 400)")).toBeVisible();
  await expect(page.getByText("TH-SANDBOX-UI ·", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Reconciliar pedido", exact: true }).click();
  expect(reconciled).toBe(true);
  await page.getByRole("button", { name: "Cancelar e liberar estoque", exact: true }).click();
  expect(canceled).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `.preview-validation/asaas-dashboard-${info.project.name}.png`, fullPage: true });
});

test("Admin Sandbox test checkout persists/reuses customer address cleanly and redirects card to hosted Asaas", async ({ page }) => {
  const addresses: Array<Record<string, unknown>> = [];
  let failSave = true;
  let adminCheckoutCalls = 0;

  await page.route("**/api/admin/auth/session", (route) =>
    route.fulfill({ json: { data: { id: "synthetic-admin", name: "Admin Sintético", email: "admin@example.test", role: "admin" } } }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { data: { ...syntheticAccount, addresses } } }),
  );
  await page.route("**/api/auth/addresses", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { data: addresses } });
    }
    if (failSave) {
      failSave = false;
      return route.fulfill({
        status: 500,
        json: { error: { code: "INTERNAL_ERROR", message: "Falha simulada ao salvar endereço." } },
      });
    }
    const body = route.request().postDataJSON();
    const saved = {
      id: "addr-admin-1",
      label: body.label || "Principal",
      zip: body.zip.replace(/\D/g, ""),
      street: body.street,
      number: body.number,
      complement: body.complement ?? "",
      city: body.city,
      state: body.state,
      isDefault: true,
      updatedAt: now,
    };
    addresses.splice(0, addresses.length, saved);
    return route.fulfill({ status: 201, json: { data: { address: saved, addresses } } });
  });
  await page.route("**/api/admin/asaas", (route) =>
    route.fulfill({
      json: {
        data: {
          environment: "sandbox",
          notice: "Testes sintéticos sem receita real",
          summary: [],
          attempts: [],
          history: [],
          products: [
            {
              id: "case-01",
              sku: "CASE-COMPACT-PRETO",
              slug: "case-compact-preto",
              name: "Case Compact Preto",
              price_cents: 4990,
              variants: ["Preto"],
              stock: 10,
            },
          ],
        },
      },
    }),
  );
  await page.route("**/api/admin/asaas/checkout", (route) => {
    adminCheckoutCalls++;
    return route.fulfill({
      json: {
        data: {
          ...receipt("card"),
          order: {
            ...receipt("card").order,
            checkoutUrl: "https://sandbox.asaas.com/checkoutSession/show?id=checkout_admin_redirect",
          },
          sandboxStock: [{ productId: "case-01", productName: "Case Compact Preto", quantity: 9 }],
        },
      },
    });
  });
  await page.route("**/api/admin/asaas/orders/sandbox-ui-order", (route) =>
    route.fulfill({ json: { data: receipt("card") } }),
  );
  await page.route("https://sandbox.asaas.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body><h1>Asaas Hosted Mock</h1></body></html>" }),
  );

  await page.goto("/admin/teste-pagamento");
  await expect(page.getByRole("heading", { name: "1. Cliente e endereço de entrega" })).toBeVisible();
  await page.locator("#checkout-zip").fill("12500000");
  await page.locator("#checkout-address").fill("Rua do Teste");
  await page.locator("#checkout-number").fill("10");
  await page.locator("#checkout-city").fill("Guaratinguetá");
  await page.locator("#checkout-state").selectOption("SP");

  // Failed address persistence blocks payment call and preserves inputs
  await page.getByRole("button", { name: "Pagar com cartão no Asaas Sandbox" }).click();
  await expect(page.locator(".error-summary[role='alert']")).toContainText("Falha simulada ao salvar endereço.");
  await expect(page.locator("#checkout-address")).toHaveValue("Rua do Teste");
  expect(adminCheckoutCalls).toBe(0);

  // Successful retry persists address and redirects immediately to hosted Asaas Sandbox
  await page.getByRole("button", { name: "Pagar com cartão no Asaas Sandbox" }).click();
  await expect(page).toHaveURL("https://sandbox.asaas.com/checkoutSession/show?id=checkout_admin_redirect");
  expect(adminCheckoutCalls).toBe(1);

  // Second purchase reloads /admin/teste-pagamento and reuses saved address without asking inputs
  await page.goto("/admin/teste-pagamento");
  await page.getByRole("button", { name: "Fazer nova compra de teste" }).click();
  await expect(page.locator(".checkout-saved-addresses")).toContainText("Rua do Teste, 10");
  await expect(page.locator("#checkout-address")).toHaveCount(0);
});

test("Admin-authenticated storefront /checkout runs Asaas Sandbox with saved address reuse and hosted card redirect", async ({ page }) => {
  const savedAddresses = [
    {
      id: "addr-prod-1",
      label: "Principal",
      zip: "12513612",
      street: "Ivan Madergan",
      number: "101",
      complement: "Casa",
      city: "Guaratinguetá",
      state: "SP",
      isDefault: true,
      updatedAt: now,
    },
  ];
  const accountWithAddress = {
    ...syntheticAccount,
    name: "BRIAN HENRIQUE",
    city: "Guaratinguetá",
    state: "SP",
    addresses: savedAddresses,
  };
  let orderStatus: "pending_payment" | "canceled" = "pending_payment";
  let adminCheckoutCalls = 0;
  let cancelCalls = 0;

  const trayReceipt = () => ({
    ...receipt("card", orderStatus),
    sandboxStock: [
      {
        productId: "tray-01",
        productName: "Bandeja Black",
        quantity: orderStatus === "canceled" ? 16 : 15,
      },
    ],
    order: {
      ...receipt("card", orderStatus).order,
      id: "sandbox-tray-order",
      orderNumber: "TH-SANDBOX-TRAY",
      subtotalCents: 3990,
      totalCents: 3990,
      checkoutUrl: "https://sandbox.asaas.com/checkoutSession/show?id=checkout_storefront_card",
      items: [
        {
          id: "item-tray-1",
          orderId: "sandbox-tray-order",
          productId: "tray-01",
          sku: "TH-TRAY-01",
          productName: "Bandeja Black",
          categorySlug: "bandejas",
          variant: "",
          quantity: 1,
          unitPriceCents: 3990,
          lineTotalCents: 3990,
          eligible: true,
        },
      ],
    },
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      "th-cart-v1",
      JSON.stringify({
        state: { items: [{ productId: "tray-01", quantity: 1, variant: "" }], favorites: [] },
        version: 0,
      }),
    );
  });
  await page.route("**/api/checkout/asaas/config", (route) =>
    route.fulfill({ json: { data: { enabled: true, mode: "admin_sandbox" } } }),
  );
  await page.route("**/api/auth/login", (route) => route.fulfill({ json: { data: accountWithAddress } }));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { data: accountWithAddress } }));
  await page.route("**/api/auth/addresses", (route) => route.fulfill({ json: { data: savedAddresses } }));
  await page.route("**/api/admin/asaas/checkout", async (route) => {
    adminCheckoutCalls++;
    expect(route.request().postDataJSON()).toMatchObject({
      paymentMethod: "card",
      callbackPath: "/checkout",
      items: [{ productId: "tray-01", quantity: 1 }],
    });
    await route.fulfill({ json: { data: trayReceipt() } });
  });
  await page.route("**/api/admin/asaas/orders/sandbox-tray-order", (route) =>
    route.fulfill({ json: { data: trayReceipt() } }),
  );
  await page.route("**/api/admin/asaas/cancel", (route) => {
    cancelCalls++;
    expect(route.request().postDataJSON()).toEqual({ orderId: "sandbox-tray-order" });
    orderStatus = "canceled";
    return route.fulfill({ json: { data: { order: trayReceipt().order } } });
  });
  await page.route("https://sandbox.asaas.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body><h1>Asaas Hosted Mock</h1></body></html>" }),
  );

  await enterCheckout(page);
  await expect(page.getByText("Modo administrador ativo (Asaas Sandbox · banco isolado).", { exact: false })).toBeVisible();
  await expect(page.locator(".checkout-saved-addresses")).toContainText("Ivan Madergan, 101");
  await expect(page.locator("#checkout-address")).toHaveCount(0);
  await expect(page.getByText("1 × Bandeja Black").first()).toBeVisible();
  await expect(page.locator("#asaas-method-pix")).toBeVisible();
  await expect(page.locator("#asaas-method-card")).toBeVisible();

  await page.locator("#asaas-method-card").check();
  await page.getByRole("button", { name: "Finalizar pedido" }).click();
  await expect(page).toHaveURL("https://sandbox.asaas.com/checkoutSession/show?id=checkout_storefront_card");
  expect(adminCheckoutCalls).toBe(1);

  await page.goto("/checkout?asaasOrder=sandbox-tray-order");
  await expect(page.getByRole("heading", { name: "Pedido TH-SANDBOX-TRAY" })).toBeVisible();
  await expect(page.getByText("Estoque isolado: Bandeja Black: 15 un.")).toBeVisible();
  expect((await new AxeBuilder({ page }).include('[aria-label="Pagamento do pedido"]').analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  await page.getByRole("button", { name: "Cancelar e liberar estoque" }).click();
  expect(cancelCalls).toBe(1);
  await expect(page.getByText("Cancelado · R$ 39,90")).toBeVisible();
});

test("Admin login returns to the storefront and Pix is recoverable without sessionStorage", async ({ page }) => {
  let authenticated = false;
  let requests = 0;
  const admin = { id: "synthetic-admin", name: "Admin Sintético", email: "admin@example.test", role: "admin" };
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === "th-asaas-sandbox-attempt") throw new DOMException("Storage blocked", "SecurityError");
      original.call(this, name, value);
    };
  });
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { data: null } }));
  await page.route("**/api/admin/auth/login", (route) => {
    authenticated = true;
    return route.fulfill({ json: { data: admin } });
  });
  await page.route("**/api/checkout/asaas/config", (route) => route.fulfill({ json: { data: {
    enabled: authenticated, mode: authenticated ? "admin_sandbox" : "disabled",
  } } }));
  await page.route("**/api/admin/asaas/checkout", (route) => {
    requests++;
    return route.fulfill({ json: { data: receipt("pix") } });
  });
  await page.route("**/api/admin/asaas/orders/sandbox-ui-order", (route) =>
    route.fulfill({ json: { data: receipt("pix") } }),
  );

  await page.goto("/checkout");
  await page.getByRole("button", { name: "Sim, tenho 18+" }).click();
  await expect(page.getByText("Pagamentos online indisponíveis para pedidos comerciais.")).toBeVisible();
  await expect(page.locator("#asaas-method-pix")).toHaveCount(0);
  await page.getByRole("link", { name: "Acesso administrativo" }).click();
  await page.locator("#admin-email").fill(admin.email);
  await page.locator("#admin-password").fill("Synthetic123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.getByRole("button", { name: "Finalizar pedido" }).click();
  await expect(page).toHaveURL(/\/checkout\?asaasOrder=sandbox-ui-order$/);
  await expect(page.getByRole("img", { name: "QR Code Pix do pedido" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pedido TH-SANDBOX-UI" })).toBeVisible();
  expect(requests).toBe(1);
});
