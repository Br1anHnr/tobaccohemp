import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Pool } from "pg";

// Matches the integration server base URL; mutations must carry a same-origin Origin.
const ORIGIN = process.env.PLAYWRIGHT_INTEGRATION_ORIGIN ?? "http://127.0.0.1:3210";

async function deleteCustomerByEmail(email: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    // Sessions, password resets and addresses are removed by the FK cascade.
    await pool.query("DELETE FROM customer_accounts WHERE email = $1", [email]);
  } finally {
    await pool.end();
  }
}

const post = (page: Page, path: string, data?: unknown) =>
  page.request.post(path, { data, headers: { Origin: ORIGIN } });
const patch = (page: Page, path: string, data?: unknown) =>
  page.request.patch(path, { data, headers: { Origin: ORIGIN } });
const del = (page: Page, path: string) =>
  page.request.delete(path, { headers: { Origin: ORIGIN } });

async function dismissAgeGate(page: Page) {
  const age = page.getByRole("button", { name: "Sim, tenho 18+" });
  if (await age.isVisible().catch(() => false)) {
    await age.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
}

test("customer sign-up requires valid phone (API + UI regression), persists profile and supports legacy login", async ({
  page,
  context,
}, info) => {
  const run = `${info.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, "-");
  const email = `e2e-${run}@example.test`;
  const legacyEmail = `legacy-${run}@example.test`;
  const password = "senhaSegura123";
  try {
    // Protected routes require a session.
    expect((await page.request.get("/api/auth/profile")).status()).toBe(401);
    expect((await page.request.get("/api/auth/addresses")).status()).toBe(401);

    // API regression: missing phone or invalid phone is rejected with 422.
    expect(
      (await post(page, "/api/auth/signup", { name: "Cliente Sem Tel", email, password })).status(),
    ).toBe(422);
    expect(
      (await post(page, "/api/auth/signup", { name: "Cliente Tel Curto", email, phone: "11999", password })).status(),
    ).toBe(422);
    expect(
      (await post(page, "/api/auth/signup", { name: "Cliente Tel Invalido", email, phone: "abcdef", password })).status(),
    ).toBe(422);

    // UI regression: missing/invalid phone blocks submission and shows clear error.
    await page.goto("/conta/cadastro");
    await dismissAgeGate(page);
    await page.getByLabel("Nome completo").fill("Cliente Regressao");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Telefone", { exact: true }).fill("12345");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar senha").fill(password);
    await page.getByRole("checkbox", { name: /18 anos/ }).check();
    await page.getByRole("checkbox", { name: /termos de uso/ }).check();
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    await expect(page.locator(".error-summary")).toContainText("telefone com DDD");
    await expect(page).toHaveURL(/\/conta\/cadastro$/);

    // Valid sign-up creates the account with persisted normalized phone and httpOnly session cookie.
    const signup = await post(page, "/api/auth/signup", {
      name: "Cliente E2E",
      email,
      phone: "(11) 98765-4321",
      password,
    });
    expect(signup.status()).toBe(201);
    const account = (await signup.json()).data;
    expect(account.email).toBe(email);
    expect(account.phone).toBe("11987654321");
    expect(account.passwordHash).toBeUndefined();
    const cookie = (await context.cookies()).find((c) => c.name === "th_customer_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    // Session resolves the signed-in customer with phone.
    const me = (await (await page.request.get("/api/auth/session")).json()).data;
    expect(me.email).toBe(email);
    expect(me.phone).toBe("11987654321");

    // Duplicate e-mail is rejected.
    expect(
      (await post(page, "/api/auth/signup", { name: "Outro", email, phone: "11999990000", password })).status(),
    ).toBe(409);

    // Profile update persists and is returned by the session.
    const result = await patch(page, "/api/auth/profile", {
      name: "Cliente Atualizado",
      phone: "(11) 98888-7777",
      city: "São Paulo",
      state: "SP",
    });
    expect(result.status()).toBe(200);
    const updated = (await (await page.request.get("/api/auth/session")).json()).data;
    expect(updated.name).toBe("Cliente Atualizado");
    expect(updated.phone).toBe("11988887777");

    // Legacy account created prior to mandatory phone (phone = '') still logs in cleanly.
    const legacySignup = await post(page, "/api/auth/signup", {
      name: "Conta Antiga",
      email: legacyEmail,
      phone: "11911112222",
      password,
    });
    expect(legacySignup.status()).toBe(201);
    const url = process.env.DATABASE_URL!;
    const pool = new Pool({ connectionString: url, max: 1 });
    try {
      await pool.query(
        "UPDATE customer_accounts SET phone = '' WHERE lower(email) = lower($1)",
        [legacyEmail],
      );
    } finally {
      await pool.end();
    }
    await post(page, "/api/auth/logout");
    const legacyLogin = await post(page, "/api/auth/login", { email: legacyEmail, password });
    expect(legacyLogin.status()).toBe(200);
    const legacyData = (await legacyLogin.json()).data;
    expect(legacyData.email).toBe(legacyEmail);
    expect(legacyData.phone).toBe("");

    await page.goto("/conta");
    await dismissAgeGate(page);
    await expect(page.locator(".account-hello")).toContainText("Conta");
  } finally {
    await deleteCustomerByEmail(email);
    await deleteCustomerByEmail(legacyEmail);
  }
});

test("customer login, logout and password recovery revoke sessions", async ({ page, context }, info) => {
  const run = `${info.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, "-");
  const email = `e2e-${run}@example.test`;
  const password = "senhaSegura123";
  const newPassword = "novaSenha456";
  try {
    await post(page, "/api/auth/signup", {
      name: "Cliente E2E",
      email,
      phone: "11999991111",
      password,
    });
    await post(page, "/api/auth/logout");
    expect((await (await page.request.get("/api/auth/session")).json()).data).toBeNull();

    // Wrong password is rejected.
    expect((await post(page, "/api/auth/login", { email, password: "errada123" })).status()).toBe(401);

    // Correct credentials create a session.
    expect((await post(page, "/api/auth/login", { email, password })).status()).toBe(200);
    expect((await context.cookies()).some((c) => c.name === "th_customer_session")).toBe(true);

    // Password recovery: request a token, reset, then re-login with the new password.
    const forgot = await post(page, "/api/auth/password/forgot", { email });
    expect(forgot.status()).toBe(200);
    const resetToken = (await forgot.json()).data.resetToken;
    expect(resetToken).toBeTruthy();

    expect((await post(page, "/api/auth/password/reset", { token: resetToken, password: newPassword })).status()).toBe(200);

    // Reset revokes every active session.
    expect((await (await page.request.get("/api/auth/session")).json()).data).toBeNull();

    // The old password no longer works; the new one does.
    await post(page, "/api/auth/logout");
    expect((await post(page, "/api/auth/login", { email, password })).status()).toBe(401);
    expect((await post(page, "/api/auth/login", { email, password: newPassword })).status()).toBe(200);

    // A reset token can never be replayed.
    expect((await post(page, "/api/auth/password/reset", { token: resetToken, password: newPassword })).status()).toBe(400);
  } finally {
    await deleteCustomerByEmail(email);
  }
});

test("full E2E without mocks: signup with phone, persisted address, repeat checkout reuse, new address, account isolation, guest checkout, demo area and Início navigation", async ({
  page,
  context,
  browser,
}, info) => {
  const run = `${info.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, "-");
  const emailA = `cliente-a-${run}@example.test`;
  const emailB = `cliente-b-${run}@example.test`;
  const password = "senhaSegura123";
  try {
    // 1. Signup via UI with mandatory phone
    await page.goto("/conta/cadastro");
    await dismissAgeGate(page);

    await page.getByLabel("Nome completo").fill("Helena Ficticia");
    await page.getByLabel("E-mail", { exact: true }).fill(emailA);
    await page.getByLabel("Telefone", { exact: true }).fill("(11) 97777-6666");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar senha").fill(password);
    await page.getByRole("checkbox", { name: /18 anos/ }).check();
    await page.getByRole("checkbox", { name: /termos de uso/ }).check();
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();

    await expect(page).toHaveURL(/\/conta$/);
    await expect(page.locator(".account-hello")).toContainText("Helena");
    await expect(page.locator(".profile-summary")).toContainText("(11) 97777-6666");

    // 2. Reload /conta — session and saved phone persist
    await page.reload();
    await expect(page.locator(".account-hello")).toContainText("Helena");
    await expect(page.locator(".profile-summary")).toContainText("(11) 97777-6666");

    // 3. First checkout: name, email and phone prefilled; enter address and save to account
    await page.goto("/produto/case-compact-preto");
    await page.getByRole("button", { name: "Adicionar Case Compact Preto ao carrinho" }).click();
    await page.getByRole("dialog").getByRole("link", { name: /Finalizar pedido/ }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await page.reload();

    await expect(page.locator(".checkout-account-banner")).toContainText("Helena Ficticia");
    await expect(page.locator("#checkout-name")).toHaveValue("Helena Ficticia");
    await expect(page.locator("#checkout-email")).toHaveValue(emailA);
    await expect(page.locator("#checkout-phone")).toHaveValue("11977776666");

    await page.locator("#checkout-zip").fill("13010000");
    await page.locator("#checkout-address").fill("Rua das Palmeiras");
    await page.locator("#checkout-number").fill("250");
    await page.locator("#checkout-complement").fill("Apto 42");
    await page.locator("#checkout-city").fill("Campinas");
    await page.locator("#checkout-state").selectOption("SP");
    await page.locator("#checkout-address-label").fill("Casa");
    await expect(page.locator("#checkout-save-address")).toBeChecked();

    await page.getByLabel("Entendo que este pedido é apenas uma demonstração.").check();
    await page.getByRole("button", { name: "Finalizar pedido", exact: true }).click();

    await expect(page).toHaveURL(/\/pedido-confirmado$/);
    await expect(page.getByRole("heading", { name: "PEDIDO RECEBIDO." })).toBeVisible();
    await expect(page.locator(".confirmation")).toContainText("Nenhuma cobrança foi realizada.");

    // Verify address persisted in profile page after reload
    await page.goto("/conta/perfil");
    await page.reload();
    await expect(page.locator(".address-list")).toContainText("Rua das Palmeiras, 250");
    await expect(page.locator(".address-list")).toContainText("Campinas / SP");

    // Capture Account A's address id from API for isolation test below
    const addrListA = (await (await page.request.get("/api/auth/addresses")).json()).data as Array<{ id: string }>;
    expect(addrListA).toHaveLength(1);
    const addressIdA = addrListA[0].id;

    // 4. Second checkout: reuses saved name, phone AND saved address without retyping anything!
    await page.goto("/produto/bandeja-black");
    await page.getByRole("button", { name: "Adicionar Bandeja Black ao carrinho" }).click();
    await page.getByRole("dialog").getByRole("link", { name: /Finalizar pedido/ }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await page.reload();

    await expect(page.locator(".checkout-account-banner")).toContainText("Helena Ficticia");
    await expect(page.locator(".checkout-account-banner")).toContainText("(11) 97777-6666");
    await expect(page.locator(".checkout-saved-addresses")).toContainText("Rua das Palmeiras, 250");
    await expect(page.locator(".checkout-saved-addresses")).toContainText("Campinas/SP");
    await expect(page.locator("#checkout-address")).toHaveCount(0); // Compact view: no repetitive inputs!

    // Check desktop/mobile horizontal fit and WCAG accessibility on repeat checkout
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy();
    const axeRepeat = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axeRepeat.violations).toEqual([]);

    // Can navigate to Início via click (mobile menu or desktop header) from /checkout
    if (info.project.name === "mobile") {
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await page
        .getByRole("navigation", { name: "Menu mobile" })
        .getByRole("link", { name: "Início", exact: true })
        .click();
    } else {
      await page
        .getByRole("navigation", { name: "Navegação principal" })
        .getByRole("link", { name: "Início", exact: true })
        .click();
    }
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /SEU ESTILO/i, level: 1 })).toBeVisible();

    // Return to /checkout and complete repeat order WITHOUT retyping any field
    await page.goto("/checkout");
    await page.getByLabel("Entendo que este pedido é apenas uma demonstração.").check();
    await page.getByRole("button", { name: "Finalizar pedido", exact: true }).click();
    await expect(page).toHaveURL(/\/pedido-confirmado$/);
    await expect(page.getByRole("heading", { name: "PEDIDO RECEBIDO." })).toBeVisible();

    // 5. Third checkout: test "Novo endereço" and delivery editing
    await page.goto("/produto/case-compact-preto");
    await page.getByRole("button", { name: "Adicionar Case Compact Preto ao carrinho" }).click();
    await page.getByRole("dialog").getByRole("link", { name: /Finalizar pedido/ }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    await page.getByRole("button", { name: "Novo endereço" }).click();
    await page.locator("#checkout-zip").fill("01310100");
    await page.locator("#checkout-address").fill("Avenida Paulista");
    await page.locator("#checkout-number").fill("1000");
    await page.locator("#checkout-city").fill("São Paulo");
    await page.locator("#checkout-state").selectOption("SP");
    await page.locator("#checkout-address-label").fill("Trabalho");
    await page.getByLabel("Entendo que este pedido é apenas uma demonstração.").check();
    await page.getByRole("button", { name: "Finalizar pedido", exact: true }).click();
    await expect(page).toHaveURL(/\/pedido-confirmado$/);

    const addrListAfter = (await (await page.request.get("/api/auth/addresses")).json()).data as Array<{ street: string }>;
    expect(addrListAfter).toHaveLength(2);
    expect(addrListAfter.some((a) => a.street === "Avenida Paulista")).toBe(true);

    // Privacy check: zero PII in browser storage
    const storedA = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(storedA).not.toContain(emailA);
    expect(storedA).not.toContain("Helena Ficticia");
    expect(storedA).not.toContain("11977776666");
    expect(storedA).not.toContain("Rua das Palmeiras");
    expect(storedA).not.toContain("Avenida Paulista");
    expect(storedA).not.toContain(password);

    // 6. Account Isolation: Account B in a separate context cannot see, edit or delete Account A's addresses
    const ctxB = await browser.newContext({
      baseURL: ORIGIN,
      viewport: info.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    });
    const pageB = await ctxB.newPage();
    try {
      const signupB = await post(pageB, "/api/auth/signup", {
        name: "Bruno Isolado",
        email: emailB,
        phone: "21966665555",
        password,
      });
      expect(signupB.status()).toBe(201);
      const listB = (await (await pageB.request.get("/api/auth/addresses")).json()).data;
      expect(listB).toEqual([]);

      // Attempting to mutate or delete Account A's address returns 404 (strict isolation)
      const hijackPatch = await patch(pageB, `/api/auth/addresses/${addressIdA}`, {
        label: "Invadido",
        zip: "20040020",
        street: "Rua Invasao",
        number: "1",
        city: "Rio de Janeiro",
        state: "RJ",
      });
      expect(hijackPatch.status()).toBe(404);
      const hijackDelete = await del(pageB, `/api/auth/addresses/${addressIdA}`);
      expect(hijackDelete.status()).toBe(404);

      await pageB.goto("/conta/perfil");
      await dismissAgeGate(pageB);
      await expect(pageB.locator("main")).not.toContainText("Rua das Palmeiras");
      await expect(pageB.locator("main")).not.toContainText("Helena Ficticia");
    } finally {
      await ctxB.close();
    }

    // Account A's addresses remain completely untouched
    const stillIntact = (await (await page.request.get("/api/auth/addresses")).json()).data as Array<{ street: string }>;
    expect(stillIntact).toHaveLength(2);
    expect(stillIntact.some((a) => a.street === "Rua das Palmeiras")).toBe(true);

    // 7. Guest checkout & demo area in a fresh anonymous context (no cookies)
    const guestCtx = await browser.newContext({
      baseURL: ORIGIN,
      viewport: info.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    });
    const guestPage = await guestCtx.newPage();
    try {
      await guestPage.goto("/produto/case-compact-preto");
      await dismissAgeGate(guestPage);
      await guestPage.getByRole("button", { name: "Adicionar Case Compact Preto ao carrinho" }).click();
      await guestPage.getByRole("dialog").getByRole("link", { name: /Finalizar pedido/ }).click();
      await expect(guestPage).toHaveURL(/\/checkout$/);

      await expect(guestPage.locator(".checkout-account-banner")).toHaveCount(0);
      await expect(guestPage.locator("#checkout-save-address")).toHaveCount(0);

      await guestPage.locator("#checkout-name").fill("Visitante Teste");
      await guestPage.locator("#checkout-email").fill("visitante@example.test");
      await guestPage.locator("#checkout-phone").fill("11955554444");
      await guestPage.locator("#checkout-zip").fill("01001000");
      await guestPage.locator("#checkout-address").fill("Praça da Sé");
      await guestPage.locator("#checkout-number").fill("10");
      await guestPage.locator("#checkout-city").fill("São Paulo");
      await guestPage.locator("#checkout-state").selectOption("SP");
      await guestPage.getByLabel("Entendo que este pedido é apenas uma demonstração.").check();
      await guestPage.getByRole("button", { name: "Finalizar pedido", exact: true }).click();

      await expect(guestPage).toHaveURL(/\/pedido-confirmado$/);
      await expect(guestPage.getByRole("heading", { name: "PEDIDO RECEBIDO." })).toBeVisible();

      const guestStored = await guestPage.evaluate(() =>
        JSON.stringify({ ...localStorage, ...sessionStorage }),
      );
      expect(guestStored).not.toContain("visitante@example.test");
      expect(guestStored).not.toContain("Visitante Teste");
      expect(guestStored).not.toContain("Praça da Sé");

      // Demo customer area still works for anonymous visitors
      await guestPage.goto("/conta");
      await guestPage.getByRole("button", { name: "Ver área demonstrativa" }).click();
      await expect(guestPage.getByText("Área do cliente demonstrativa.")).toBeVisible();
    } finally {
      await guestCtx.close();
    }

    // Confirm cookie on main context stayed httpOnly
    const finalCookie = (await context.cookies()).find((c) => c.name === "th_customer_session");
    expect(finalCookie?.httpOnly).toBe(true);
  } finally {
    await deleteCustomerByEmail(emailA);
    await deleteCustomerByEmail(emailB);
  }
});
