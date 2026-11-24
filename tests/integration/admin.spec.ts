import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Pool } from "pg";

const password = process.env.ADMIN_PASSWORD ?? "synthetic-integration-password";

async function deleteProductsBySku(sku: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    // Inventory rows are removed by the FK cascade.
    await pool.query("DELETE FROM products WHERE sku = $1", [sku]);
  } finally {
    await pool.end();
  }
}

test("dashboard usa sessão, cadastro, estoque e indicadores reais do Neon", async ({ page, context }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const run = `${info.project.name}-${Date.now()}`;
  const sku = `E2E-${run.toUpperCase().replace(/[^A-Z0-9._-]/g, "-")}`;
  const name = `Produto E2E ${run}`;
  let created = false;

  try {
    // Sem sessão, as rotas protegidas respondem 401.
    expect((await page.request.get("/api/admin/customers")).status()).toBe(401);
    // Origem inválida em mutação é rejeitada mesmo na rota pública de login.
    expect((await page.request.post("/api/admin/auth/login", {
      headers: { Origin: "https://invalid.example.test" }, data: {},
    })).status()).toBe(403);

    await page.goto("/admin/produtos");
    await expect(page).toHaveURL(/\/admin\/login\?next=/);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);

    await page.getByLabel("E-mail", { exact: true }).fill("admin@example.test");
    await page.getByLabel("Senha", { exact: true }).fill("wrong-synthetic-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.locator("form [role='alert']")).toHaveText("Credenciais inválidas.");

    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/produtos$/);
    const cookie = (await context.cookies()).find(item => item.name === "th_admin_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    // Cadastro de produto pela interface.
    await page.getByRole("button", { name: "Cadastrar produto", exact: true }).click();
    await page.getByLabel("Nome", { exact: true }).fill(name);
    await page.getByLabel("SKU", { exact: true }).fill(sku);
    await page.getByLabel("Preço (R$)", { exact: true }).fill("19,90");
    await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
    const row = page.locator(".admin-table tbody tr").filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row).toContainText(/19,90/);
    await expect(row.locator(".stock-value")).toHaveText("0");
    created = true;

    // Edição de estoque persiste após reload.
    await row.getByRole("button", { name: `Aumentar estoque de ${name}`, exact: true }).click();
    await expect(row.locator(".stock-value")).toHaveText("1");
    await page.reload();
    await expect(row.locator(".stock-value")).toHaveText("1");

    // Indicadores refletem o produto cadastrado e a unidade em estoque.
    const metrics = (await (await page.request.get("/api/admin/dashboard?environment=commercial")).json()).data;
    await page.goto("/admin");
    await expect(page.locator(".kpi-card")).toHaveCount(7);
    await expect(page.locator(".kpi-card").filter({ hasText: "Produtos ativos" }).locator(".kpi-card__value")).toHaveText(String(metrics.products));
    await expect(page.locator(".kpi-card").filter({ hasText: "Unidades em estoque" }).locator(".kpi-card__value")).toHaveText(String(metrics.units));
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (info.project.name === "mobile") {
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await expect(page.locator(".admin-sidebar")).toHaveClass(/is-open/);
      await page.keyboard.press("Escape");
      await expect(page.locator(".admin-sidebar")).not.toHaveClass(/is-open/);
    }

    // Sem fallback para mocks: falha de rede não exibe dados fictícios.
    await page.goto("/admin/produtos");
    await page.route("**/api/admin/products", route => route.abort());
    await page.reload();
    await expect(page.getByRole("heading", { name: "Não foi possível carregar." })).toBeVisible();
    await page.unroute("**/api/admin/products");
    await page.getByRole("button", { name: /Tentar novamente/ }).click();
    await expect(page.locator(".admin-table tbody tr").filter({ hasText: name })).toBeVisible();

    await page.screenshot({ path: `artifacts/admin-connected-${info.project.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect((await page.request.get("/api/admin/customers")).status()).toBe(401);
  } finally {
    if (created) await deleteProductsBySku(sku);
  }
});
