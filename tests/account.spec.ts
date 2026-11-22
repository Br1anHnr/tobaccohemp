import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function enter(page: Page, path = "/") {
  await page.goto(path);
  await page.getByRole("button", { name: "Sim, tenho 18+" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

// The customer backend is available only in development/test; the e2e suite
// (production build) exercises the UI against these controlled fixtures.
const signedOutSession = (route: import("@playwright/test").Route) =>
  route.fulfill({ json: { data: null } });

test("login validates and never fakes authentication or stores passwords", async ({
  page,
}) => {
  await page.route("**/api/auth/session", signedOutSession);
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 401, json: { error: { code: "INVALID_CREDENTIALS", message: "Credenciais inválidas." } } }),
  );
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
  await expect(page.locator(".auth-notice")).toContainText("Credenciais inválidas.");
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");
  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(stored).not.toContain("segredo123");
  expect(stored).not.toContain("cliente@example.com");
});

test("sign-up and password recovery validate fields", async ({ page }) => {
  await page.route("**/api/auth/session", signedOutSession);
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
  await page.getByRole("button", { name: "Enviar instruções", exact: true }).click();
  await expect(page.locator(".error-summary")).toContainText("e-mail válido");
});

test("sign-up creates an account and opens the customer area", async ({ page }) => {
  await page.route("**/api/auth/session", signedOutSession);
  await page.route("**/api/auth/signup", (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: { data: { id: "e2e", name: body.name, email: body.email, phone: "", city: "", state: "", createdAt: "2026-01-01T00:00:00.000Z" } },
    });
  });
  await enter(page, "/conta/cadastro");
  await page.getByLabel("Nome completo").fill("Maria Cliente");
  await page.getByLabel("E-mail", { exact: true }).fill("maria@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senhaSegura123");
  await page.getByLabel("Confirmar senha").fill("senhaSegura123");
  await page.getByRole("checkbox", { name: /18 anos/ }).check();
  await page.getByRole("checkbox", { name: /termos de uso/ }).check();
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.locator(".account-hello")).toContainText("Maria");
});

test("signed-in customer reuses account data in demo checkout without re-registering", async ({
  page,
}, testInfo) => {
  await page.route("**/api/auth/session", signedOutSession);
  await page.route("**/api/auth/signup", (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: {
        data: {
          id: "e2e-checkout",
          name: body.name,
          email: body.email,
          phone: "11988887777",
          city: "São Paulo",
          state: "SP",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
    });
  });

  await enter(page, "/conta/cadastro");
  await page.getByLabel("Nome completo").fill("Marina Checkout");
  await page.getByLabel("E-mail", { exact: true }).fill("marina.demo@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("senhaSegura123");
  await page.getByLabel("Confirmar senha").fill("senhaSegura123");
  await page.getByRole("checkbox", { name: /18 anos/ }).check();
  await page.getByRole("checkbox", { name: /termos de uso/ }).check();
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/conta$/);

  if (testInfo.project.name === "desktop") {
    await page.getByRole("button", { name: "Minha conta" }).click();
    const accountModal = page.getByRole("dialog");
    await expect(accountModal).toContainText("Marina Checkout");
    await expect(accountModal.getByRole("link", { name: "Ir para minha conta" })).toBeVisible();
    await expect(accountModal.getByRole("link", { name: "Criar conta" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link", { name: "Loja", exact: true })
      .click();
  } else {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("navigation", { name: "Menu mobile" })
      .getByRole("link", { name: "Loja", exact: true })
      .click();
  }
  await expect(page).toHaveURL(/\/loja$/);
  await page.locator(".product-card a").first().click();
  await page.locator("button:has-text('Adicionar')").first().click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /Finalizar pedido/ })
    .click();
  await expect(page).toHaveURL(/\/checkout$/);

  await expect(page.locator(".checkout-account-banner")).toContainText("Marina Checkout");
  await expect(page.locator(".checkout-account-banner")).toContainText("marina.demo@example.test");
  await expect(page.locator("#checkout-name")).toHaveValue("Marina Checkout");
  await expect(page.locator("#checkout-email")).toHaveValue("marina.demo@example.test");
  await expect(page.locator("#checkout-phone")).toHaveValue("11988887777");
  await expect(page.locator("#checkout-city")).toHaveValue("São Paulo");
  await expect(page.locator("#checkout-state")).toHaveValue("SP");

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);

  await page.locator("#checkout-zip").fill("01001000");
  await page.locator("#checkout-address").fill("Rua Ficticia");
  await page.locator("#checkout-number").fill("42");
  await page
    .getByLabel("Entendo que este pedido é apenas uma demonstração.")
    .check();
  await page
    .getByRole("button", { name: "Finalizar pedido", exact: true })
    .click();
  await expect(page).toHaveURL(/pedido-confirmado/);
  await expect(
    page.getByRole("heading", { name: "PEDIDO RECEBIDO." }),
  ).toBeVisible();

  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(stored).not.toContain("marina.demo@example.test");
  expect(stored).not.toContain("Marina Checkout");
  expect(stored).not.toContain("senhaSegura123");
});

test("password recovery requests a reset and applies a new password", async ({ page }) => {
  await page.route("**/api/auth/session", signedOutSession);
  await page.route("**/api/auth/password/forgot", (route) =>
    route.fulfill({ json: { data: { message: "instruções", resetToken: "e2e-token" } } }),
  );
  await page.route("**/api/auth/password/reset", (route) =>
    route.fulfill({ json: { data: null } }),
  );
  await enter(page, "/conta/recuperar-senha");
  await page.getByLabel("E-mail", { exact: true }).fill("cliente@example.com");
  await page.getByRole("button", { name: "Enviar instruções", exact: true }).click();
  await expect(page).toHaveURL(/redefinir-senha\?token=e2e-token/);
  await page.getByLabel("Nova senha", { exact: true }).fill("novaSenha123");
  await page.getByLabel("Confirmar nova senha").fill("novaSenha123");
  await page.getByRole("button", { name: "Redefinir senha", exact: true }).click();
  await expect(page.getByText("Senha redefinida com sucesso.")).toBeVisible();
});

test("demo customer area: overview, orders, reorder and profile", async ({
  page,
}) => {
  await page.route("**/api/auth/session", signedOutSession);
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
  await page.route("**/api/auth/session", signedOutSession);
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
