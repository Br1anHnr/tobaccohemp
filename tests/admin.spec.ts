import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Visual regression fixtures use the HTTP contract, independently of a live backend.
// Real cookie/proxy/persistence coverage lives in tests/integration/admin.spec.ts.
test.beforeEach(async ({ page }) => {
  const inventory = [
    { productId: "kit", quantity: 4, reorderPoint: 5, updatedAt: "2026-01-01T00:00:00.000Z" },
    { productId: "mug", quantity: 0, reorderPoint: 2, updatedAt: "2026-01-01T00:00:00.000Z" },
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
      { id: "kit", name: "Kit Urban", sku: "KIT-001", priceCents: 8990, active: true, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "mug", name: "Caneca", sku: "MUG-001", priceCents: 3500, active: true, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    else if (path === "/api/admin/inventory") data = inventory;
    else if (path.startsWith("/api/admin/inventory/") && route.request().method() === "PATCH") {
      const item = inventory.find(row => row.productId === path.split("/").at(-1));
      Object.assign(item ?? {}, route.request().postDataJSON());
      data = item;
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
  await expect(page.getByText("Vendas desabilitadas — nenhum dado comercial conectado.")).toBeVisible();
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

test("production build keeps the administrative proxy disabled", async ({ request }) => {
  expect((await request.get("/api/admin/auth/session")).status()).toBe(503);
  expect((await request.get("/api/admin/customers")).status()).toBe(503);
  expect((await request.post("/api/admin/auth/login", { data: {} })).status()).toBe(503);
});
