import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const origin = "http://127.0.0.1:3210";

test("dashboard existente usa sessão, dados e estoque reais do backend local", async ({ page, context }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const unique = `${info.project.name}-${Date.now()}`;
  expect((await page.request.get("/api/admin/customers")).status()).toBe(401);
  expect((await page.request.post("/api/admin/auth/login", {
    headers: { Origin: "https://invalid.example.test" }, data: {},
  })).status()).toBe(403);
  expect((await page.request.post("/api/admin/checkout", { headers: { Origin: origin }, data: {} })).status()).toBe(404);
  await page.goto("/admin/produtos");
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.getByLabel("E-mail", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("wrong-synthetic-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator("form [role='alert']")).toHaveText("Credenciais inválidas.");
  await page.getByLabel("Senha", { exact: true }).fill("synthetic-integration-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/produtos$/);
  const cookie = (await context.cookies()).find(item => item.name === "golden_admin_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");

  const productResponse = await page.request.post("/api/admin/products", {
    headers: { Origin: origin }, data: { sku: unique.toUpperCase(), name: `Caderno ${unique}`, priceCents: 1990, active: true },
  });
  expect(productResponse.status()).toBe(201);
  const product = (await productResponse.json()).data;
  await page.reload();
  const row = page.locator(".admin-table tbody tr").filter({ hasText: product.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText(/19,90/);
  await expect(row.locator(".stock-value")).toHaveText("0");
  await row.getByRole("button", { name: `Aumentar estoque de ${product.name}`, exact: true }).click();
  await expect(row.locator(".stock-value")).toHaveText("1");
  await page.reload();
  await expect(row.locator(".stock-value")).toHaveText("1");

  const stockPath = `/api/admin/inventory/${product.id}`;
  await page.route(`**${stockPath}`, route => route.fulfill({ status: 422, json: { error: { code: "SYNTHETIC", message: "Falha sintética de estoque." } } }));
  await row.getByRole("button", { name: `Aumentar estoque de ${product.name}`, exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Falha sintética de estoque." })).toHaveText("Falha sintética de estoque.");
  await expect(row.locator(".stock-value")).toHaveText("1");
  await page.unroute(`**${stockPath}`);
  const inventory = (await (await page.request.get("/api/admin/inventory")).json()).data;
  expect(inventory.find((item: { productId: string }) => item.productId === product.id).quantity).toBe(1);

  await page.route("**/api/admin/products", route => route.abort());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Não foi possível carregar." })).toBeVisible();
  await expect(page.getByText("Kit Urban", { exact: true })).toHaveCount(0);
  await page.unroute("**/api/admin/products");
  await page.getByRole("button", { name: /Tentar novamente/ }).click();
  await expect(row).toBeVisible();

  const customerResponse = await page.request.post("/api/admin/customers", {
    headers: { Origin: origin }, data: { name: `Cliente ${unique}`, email: `${unique}@example.test`, status: "active" },
  });
  expect(customerResponse.status()).toBe(201);
  await page.goto("/admin/clientes");
  const customer = page.locator(".admin-table tbody tr").filter({ hasText: `Cliente ${unique}` });
  await expect(customer).toBeVisible();
  await expect(customer).toContainText("Não informado");
  await expect(customer).toContainText("Ativo");

  const metrics = (await (await page.request.get("/api/admin/dashboard")).json()).data;
  await page.goto("/admin");
  await expect(page.locator(".kpi-card")).toHaveCount(4);
  await expect(page.locator(".kpi-card").filter({ hasText: "Clientes cadastrados" }).locator(".kpi-card__value")).toHaveText(String(metrics.customers));
  await expect(page.getByText("Vendas desabilitadas — nenhum dado comercial conectado.")).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.locator(".admin-sidebar")).toHaveClass(/is-open/);
    await page.keyboard.press("Escape");
    await expect(page.locator(".admin-sidebar")).not.toHaveClass(/is-open/);
  }
  await page.screenshot({ path: `artifacts/admin-connected-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await page.request.get("/api/admin/customers")).status()).toBe(401);
});
