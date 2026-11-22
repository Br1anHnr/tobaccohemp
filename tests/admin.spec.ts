import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Visual regression fixtures use the HTTP contract, independently of a live backend.
// Real cookie/proxy/persistence coverage lives in tests/integration/admin.spec.ts.
test.beforeEach(async ({ page }) => {
  const inventory = [
    { productId: "kit", quantity: 4, reorderPoint: 5, updatedAt: "2026-01-01T00:00:00.000Z" },
    { productId: "mug", quantity: 0, reorderPoint: 2, updatedAt: "2026-01-01T00:00:00.000Z" },
  ];
  const orders = [
    {
      id: "ord-1",
      orderNumber: "TH-DEMO1001",
      customerAccountId: null,
      customerLabel: "Cliente Sandbox 1",
      status: "pending_payment",
      channel: "site",
      paymentProvider: "demo",
      paymentMethod: "pix",
      providerReference: "DEMO-TH-DEMO1001-AAA111",
      checkoutUrl: null,
      subtotalCents: 8990,
      shippingCents: 0,
      discountCents: 0,
      totalCents: 8990,
      currency: "BRL",
      isDemo: true,
      eligibilityStatus: "eligible_demo",
      expiresAt: "2026-12-01T00:30:00.000Z",
      createdAt: "2026-11-15T12:00:00.000Z",
      updatedAt: "2026-11-15T12:00:00.000Z",
      items: [
        {
          id: "item-1",
          orderId: "ord-1",
          productId: "kit",
          sku: "KIT-001",
          productName: "Kit Urban",
          categorySlug: "kits",
          variant: "Preto",
          quantity: 1,
          unitPriceCents: 8990,
          lineTotalCents: 8990,
          eligible: true,
        },
      ],
      history: [
        {
          id: "hist-1",
          orderId: "ord-1",
          fromStatus: null,
          toStatus: "draft",
          reason: "Pedido demonstrativo criado com preços congelados.",
          actorType: "admin",
          actorId: "local-admin",
          createdAt: "2026-11-15T12:00:00.000Z",
        },
        {
          id: "hist-2",
          orderId: "ord-1",
          fromStatus: "draft",
          toStatus: "pending_payment",
          reason: "Simulação de Pix demonstrativo.",
          actorType: "system",
          actorId: "demo",
          createdAt: "2026-11-15T12:00:01.000Z",
        },
      ],
    },
    {
      id: "ord-2",
      orderNumber: "TH-DEMO1002",
      customerAccountId: null,
      customerLabel: "Atendimento WhatsApp Demo",
      status: "paid",
      channel: "whatsapp_link",
      paymentProvider: "demo",
      paymentMethod: "pix",
      providerReference: "DEMO-TH-DEMO1002-BBB222",
      checkoutUrl: null,
      subtotalCents: 3500,
      shippingCents: 0,
      discountCents: 0,
      totalCents: 3500,
      currency: "BRL",
      isDemo: true,
      eligibilityStatus: "eligible_demo",
      expiresAt: "2026-12-01T00:30:00.000Z",
      createdAt: "2026-11-14T10:00:00.000Z",
      updatedAt: "2026-11-14T10:15:00.000Z",
      items: [
        {
          id: "item-2",
          orderId: "ord-2",
          productId: "mug",
          sku: "MUG-001",
          productName: "Caneca",
          categorySlug: "acessorios",
          variant: "",
          quantity: 1,
          unitPriceCents: 3500,
          lineTotalCents: 3500,
          eligible: true,
        },
      ],
      history: [
        {
          id: "hist-3",
          orderId: "ord-2",
          fromStatus: null,
          toStatus: "draft",
          reason: "Pedido demonstrativo criado com preços congelados.",
          actorType: "admin",
          actorId: "local-admin",
          createdAt: "2026-11-14T10:00:00.000Z",
        },
        {
          id: "hist-4",
          orderId: "ord-2",
          fromStatus: "pending_payment",
          toStatus: "paid",
          reason: "Confirmação simulada em sandbox.",
          actorType: "admin",
          actorId: "local-admin",
          createdAt: "2026-11-14T10:15:00.000Z",
        },
      ],
    },
  ];
  await page.route("**/api/admin/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown;
    if (path === "/api/admin/auth/session") data = { id: "test-admin", name: "Admin Sintético", email: "admin@example.test", role: "admin" };
    else if (path === "/api/admin/customers") data = [
      { id: "one", name: "Cliente Exemplo", email: "one@example.test", status: "active", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "two", name: "Cliente Inativo", email: "two@example.test", status: "inactive", createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    else if (path === "/api/admin/products") data = [
      { id: "kit", slug: "kit-urban", name: "Kit Urban", sku: "KIT-001", description: "Kit demonstrativo", brand: "Seleção da loja", categorySlug: "kits", categoryName: "Kits", priceCents: 8990, active: true, archived: false, isNew: false, isFeatured: true, tags: [], variants: [], images: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "mug", slug: "caneca", name: "Caneca", sku: "MUG-001", description: "", brand: "Seleção da loja", categorySlug: null, categoryName: null, priceCents: 3500, active: true, archived: false, isNew: false, isFeatured: false, tags: [], variants: [], images: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    else if (path === "/api/admin/categories") data = [
      { slug: "kits", name: "Kits", description: "Combinações de acessórios.", image: "/products/kit.webp", productCount: 1, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    else if (path === "/api/admin/inventory") data = inventory;
    else if (path.startsWith("/api/admin/inventory/") && route.request().method() === "PATCH") {
      const item = inventory.find(row => row.productId === path.split("/").at(-1));
      Object.assign(item ?? {}, route.request().postDataJSON());
      data = item;
    } else if (path === "/api/admin/orders" && route.request().method() === "GET") {
      data = orders.map((order) => {
        const summary = { ...order } as Record<string, unknown>;
        delete summary.items;
        delete summary.history;
        return summary;
      });
    } else if (path === "/api/admin/orders" && route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { customerLabel?: string; channel: "site" | "whatsapp_link"; paymentMethod: "pix" | "card" | "demo"; items: Array<{ productId: string; quantity: number }> };
      const created = {
        id: `ord-${orders.length + 1}`,
        orderNumber: "TH-DEMO1003",
        customerAccountId: null,
        customerLabel: body.customerLabel || "Pedido demonstrativo",
        status: "pending_payment" as const,
        channel: body.channel,
        paymentProvider: "demo" as const,
        paymentMethod: body.paymentMethod,
        providerReference: "DEMO-TH-DEMO1003-CCC333",
        checkoutUrl: null,
        subtotalCents: 8990 * (body.items[0]?.quantity ?? 1),
        shippingCents: 0,
        discountCents: 0,
        totalCents: 8990 * (body.items[0]?.quantity ?? 1),
        currency: "BRL" as const,
        isDemo: true,
        eligibilityStatus: "eligible_demo" as const,
        expiresAt: "2026-12-01T00:30:00.000Z",
        createdAt: "2026-11-15T14:00:00.000Z",
        updatedAt: "2026-11-15T14:00:00.000Z",
        items: [{ id: "item-3", orderId: `ord-${orders.length + 1}`, productId: "kit", sku: "KIT-001", productName: "Kit Urban", categorySlug: "kits", variant: "", quantity: body.items[0]?.quantity ?? 1, unitPriceCents: 8990, lineTotalCents: 8990 * (body.items[0]?.quantity ?? 1), eligible: true }],
        history: [{ id: "hist-5", orderId: `ord-${orders.length + 1}`, fromStatus: "draft" as const, toStatus: "pending_payment" as const, reason: "Simulação de Pix demonstrativo.", actorType: "system" as const, actorId: "demo", createdAt: "2026-11-15T14:00:00.000Z" }],
      };
      orders.unshift(created);
      return route.fulfill({ status: 201, json: { data: created }, headers: { "Cache-Control": "no-store" } });
    } else if (path.startsWith("/api/admin/orders/") && route.request().method() === "GET") {
      const order = orders.find(row => row.id === path.split("/").at(-1));
      if (!order) return route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "Registro não encontrado." } } });
      data = order;
    } else if (path.startsWith("/api/admin/orders/") && route.request().method() === "PATCH") {
      const order = orders.find(row => row.id === path.split("/").at(-1));
      if (!order) return route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "Registro não encontrado." } } });
      const body = route.request().postDataJSON() as { status: string; reason?: string };
      const prev = order.status;
      order.status = body.status as typeof order.status;
      order.updatedAt = "2026-11-15T15:00:00.000Z";
      order.history.push({
        id: `hist-${order.history.length + 10}`,
        orderId: order.id,
        fromStatus: prev,
        toStatus: order.status,
        reason: body.reason || "Atualizado no painel.",
        actorType: "admin",
        actorId: "local-admin",
        createdAt: "2026-11-15T15:00:00.000Z",
      });
      data = order;
    } else if (path === "/api/admin/dashboard") data = { customers: 2, products: 2, units: 4, lowStockProducts: 2, stockValueCents: 35960 };
    else return route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "Fixture não disponível." } } });
    return route.fulfill({ json: { data }, headers: { "Cache-Control": "no-store" } });
  });
});

test("admin dashboard renders indicators and charts without overflow", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /Painel/ })).toBeVisible();
  await expect(page.getByText("Valor em estoque", { exact: true })).toBeVisible();
  await expect(page.getByText("Vendas reais desabilitadas — apenas pedidos demonstrativos.")).toBeVisible();
  await expect(page.locator(".kpi-card")).toHaveCount(4);
  await expect(page.locator(".chart-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `artifacts/admin-api-adapter-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("customers table searches and shows empty state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/clientes");
  await expect(page.getByRole("heading", { name: /Clientes/ })).toBeVisible();
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(2);

  await page
    .getByPlaceholder("Buscar por nome, e-mail ou cidade")
    .fill("não existe ninguém assim");
  await expect(page.getByText("Nenhum cliente encontrado.")).toBeVisible();
  await expect(page.locator(".admin-table")).toHaveCount(0);

  await page.getByPlaceholder("Buscar por nome, e-mail ou cidade").fill("");
  await page.getByLabel("Status").selectOption("inativo");
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(1);
});

test("products table adjusts stock and recovers from simulated error", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/produtos");
  await expect(page.locator(".admin-table tbody tr").first()).toBeVisible();

  const row = page.locator(".admin-table tbody tr").filter({ hasText: "Kit Urban" });
  await expect(row.locator(".stock-value")).toHaveText("4");
  await row.getByRole("button", { name: "Aumentar estoque de Kit Urban" }).click();
  await expect(row.locator(".stock-value")).toHaveText("5");
  await row.getByRole("button", { name: "Diminuir estoque de Kit Urban" }).click();
  await expect(row.locator(".stock-value")).toHaveText("4");

  await page
    .getByRole("button", { name: "Simular falha de carregamento" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Não foi possível carregar." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Tentar novamente/ }).click();
  await expect(page.locator(".admin-table tbody tr").first()).toBeVisible();
});

test("categorias page lists categories and product edit form opens pre-filled", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/categorias");
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".admin-table")).toContainText("Kits");

  await page.goto("/admin/produtos");
  await expect(page.locator(".admin-table tbody tr").first()).toBeVisible();
  await expect(page.getByLabel("Mídia")).toBeVisible();
  const row = page.locator(".admin-table tbody tr").filter({ hasText: "Kit Urban" });
  await row.getByRole("button", { name: "Editar Kit Urban" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue("Kit Urban");
  await expect(dialog.getByLabel("Preço (R$)", { exact: true })).toHaveValue(/89/);
  await expect(dialog.locator("#product-variants")).toBeVisible();
  await expect(dialog.locator("#product-tags")).toBeVisible();
  await expect(dialog.locator("#product-reorder")).toBeVisible();
});

test("admin layout is responsive and its sidebar opens on mobile", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.locator(".admin-sidebar")).toHaveClass(/is-open/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".admin-sidebar")).not.toHaveClass(/is-open/);
});

test("admin pages pass basic accessibility checks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /Painel/ })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("orders page filters, inspects detail history, transitions status and creates demo order", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/pedidos");
  await expect(page.getByRole("heading", { name: /Pedidos/ })).toBeVisible();
  await expect(page.locator(".kpi-card")).toHaveCount(4);
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(2);

  await page.getByLabel("Status").selectOption("paid");
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(1);
  await page.getByLabel("Status").selectOption("all");
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(2);

  await page.getByRole("button", { name: "Ver detalhes do pedido TH-DEMO1001" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Kit Urban");
  await expect(dialog).toContainText("Histórico de transições");
  await dialog.getByLabel("Motivo da alteração (opcional)").fill("Pagamento sandbox aprovado");
  await dialog.getByRole("button", { name: "Marcar como Pago" }).click();
  await expect(dialog).toContainText("Pagamento sandbox aprovado");
  await dialog.getByRole("button", { name: "Fechar" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "Novo pedido demo" }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog.getByLabel("Identificação do pedido (opcional)").fill("Pedido Novo E2E");
  await createDialog.getByRole("button", { name: "Criar pedido demo" }).click();
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(3);
  await expect(page.locator(".admin-table")).toContainText("TH-DEMO1003");

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBeTruthy();

  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
});

test("production build keeps the administrative proxy disabled", async ({ request }) => {
  expect((await request.get("/api/admin/auth/session")).status()).toBe(503);
  expect((await request.get("/api/admin/customers")).status()).toBe(503);
  expect((await request.get("/api/admin/orders")).status()).toBe(503);
  expect((await request.post("/api/admin/auth/login", { data: {} })).status()).toBe(503);
});
