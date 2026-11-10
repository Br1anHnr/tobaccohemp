import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function enter(page: Page, path = "/") {
  await page.goto(path);
  await page.getByRole("button", { name: "Sim, tenho 18+" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("login validates and never fakes authentication or stores passwords", async ({
  page,
}) => {
  await enter(page, "/conta/entrar");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator(".error-summary")).toBeFocused();
  await page.getByLabel("E-mail", { exact: true }).fill("cliente@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("segredo123");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator(".auth-notice")).toContainText(
    "ainda não está ativa",
  );
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");
  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(stored).not.toContain("segredo123");
  expect(stored).not.toContain("cliente@example.com");
});

test("sign-up and password recovery validate fields", async ({ page }) => {
  await enter(page, "/conta/cadastro");
  await page.getByLabel("Nome completo").fill("Cliente Teste");
  await page.getByLabel("E-mail", { exact: true }).fill("invalido");
  await page.getByLabel("Senha", { exact: true }).fill("abc");
  await page.getByLabel("Confirmar senha").fill("abcd");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  const summary = page.locator(".error-summary");
  await expect(summary).toContainText("e-mail válido");
  await expect(summary).toContainText("ao menos 8 caracteres");
  await expect(summary).toContainText("não coincidem");
  await expect(summary).toContainText("18 anos");
  await page.goto("/conta/recuperar-senha");
  await page.getByLabel("E-mail", { exact: true }).fill("cliente@example.com");
  await page
    .getByRole("button", { name: "Enviar instruções", exact: true })
    .click();
  await expect(page.locator(".auth-notice")).toContainText(
    "Nenhum dado foi enviado",
  );
});

test("demo customer area: overview, orders, reorder and profile", async ({
  page,
}) => {
  await enter(page, "/conta");
  await expect(
    page.getByRole("heading", { name: "Entre para acessar sua conta." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver área demonstrativa" }).click();
  await expect(page.getByText("Área do cliente demonstrativa.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "TH-DEMO0003" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "TH-DEMO0003" })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Área do cliente" })
    .getByRole("link", { name: "Meus pedidos" })
    .click();
  await expect(page.locator(".order-card")).toHaveCount(3);
  await page.getByLabel("Status").selectOption("entregue");
  await expect(page.locator(".order-card")).toHaveCount(1);
  await page.locator(".order-card summary").click();
  await expect(page.locator(".order-items li")).toHaveCount(1);
  await page.getByRole("button", { name: "Comprar novamente" }).click();
  const cart = page.getByRole("dialog");
  await expect(cart).toBeVisible();
  await expect(cart.getByText("Grafite", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/conta/perfil");
  await page.getByLabel("Telefone").fill("123");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator(".error-summary")).toContainText("telefone");
  await page.getByLabel("Telefone").fill("(11) 98888-7777");
  await page.getByLabel("Nome completo").fill("Ana Demonstração");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator(".form-feedback")).toContainText(
    "sessão demonstrativa",
  );
  await expect(page.locator(".account-hello")).toContainText("Ana");
  expect(
    await page.evaluate(() => sessionStorage.getItem("th-demo-account")),
  ).not.toContain("Ana");

  await page.getByRole("button", { name: "Sair da demonstração" }).click();
  await expect(page).toHaveURL(/conta\/entrar/);
  await page.goto("/conta");
  await expect(
    page.getByRole("heading", { name: "Entre para acessar sua conta." }),
  ).toBeVisible();
});

test("catalog text search filters, shows empty state and syncs URL", async ({
  page,
}) => {
  await enter(page, "/loja");
  const search = page.getByRole("searchbox", { name: "Buscar no catálogo" });
  await search.fill("bandeja");
  await expect(page).toHaveURL(/q=bandeja/);
  await expect(page.locator(".catalog .product-card")).toHaveCount(3);
  await search.fill("zzzz");
  await expect(page.getByText("Nenhum resultado para", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(page.locator(".catalog .product-card")).not.toHaveCount(0);
  await page.getByRole("button", { name: "Buscar produtos" }).click();
  await page.getByRole("textbox", { name: "Buscar produtos" }).fill("case");
  await page.getByRole("link", { name: /Ver todos os resultados/ }).click();
  await expect(page).toHaveURL(/loja\?q=case/);
  await expect(search).toHaveValue("case");
});

test("account screens have no basic accessibility violations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page, "/conta/cadastro");
  for (const path of ["/conta/cadastro", "/conta/entrar", "/conta"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
  await page.getByRole("button", { name: "Ver área demonstrativa" }).click();
  for (const path of ["/conta", "/conta/pedidos", "/conta/perfil"]) {
    await page.goto(path);
    await expect(page.locator(".account-layout")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});
