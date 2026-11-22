import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";

// Matches the integration server base URL; POSTs must carry a same-origin Origin.
const ORIGIN = "http://127.0.0.1:3210";

async function deleteCustomerByEmail(email: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    // Sessions and password resets are removed by the FK cascade.
    await pool.query("DELETE FROM customer_accounts WHERE email = $1", [email]);
  } finally {
    await pool.end();
  }
}

const post = (page: Page, path: string, data?: unknown) =>
  page.request.post(path, { data, headers: { Origin: ORIGIN } });
const patch = (page: Page, path: string, data?: unknown) =>
  page.request.patch(path, { data, headers: { Origin: ORIGIN } });

test("customer sign-up, session, duplicate and profile persist against Neon", async ({ page, context }, info) => {
  const run = `${info.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, "-");
  const email = `e2e-${run}@example.test`;
  const password = "senhaSegura123";
  try {
    // Protected routes require a session.
    expect((await page.request.get("/api/auth/profile")).status()).toBe(401);

    // Sign-up creates the account and sets an httpOnly session cookie.
    const signup = await post(page, "/api/auth/signup", { name: "Cliente E2E", email, password });
    expect(signup.status()).toBe(201);
    const account = (await signup.json()).data;
    expect(account.email).toBe(email);
    expect(account.passwordHash).toBeUndefined();
    const cookie = (await context.cookies()).find((c) => c.name === "th_customer_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    // Session resolves the signed-in customer.
    const me = (await (await page.request.get("/api/auth/session")).json()).data;
    expect(me.email).toBe(email);

    // Duplicate e-mail is rejected without leaking which account exists.
    expect((await post(page, "/api/auth/signup", { name: "Outro", email, password })).status()).toBe(409);

    // Profile update persists and is returned by the session.
    const result = await patch(page, "/api/auth/profile", {
      name: "Cliente Atualizado", phone: "(11) 98888-7777", city: "São Paulo", state: "SP",
    });
    expect(result.status()).toBe(200);
    const updated = (await (await page.request.get("/api/auth/session")).json()).data;
    expect(updated.name).toBe("Cliente Atualizado");
    expect(updated.phone).toBe("11988887777");

    // The customer area reflects the signed-in profile.
    await page.goto("/conta");
    const age = page.getByRole("button", { name: "Sim, tenho 18+" });
    if (await age.isVisible()) await age.click();
    await expect(page.locator(".account-hello")).toContainText("Cliente");
  } finally {
    await deleteCustomerByEmail(email);
  }
});

test("customer login, logout and password recovery revoke sessions", async ({ page, context }, info) => {
  const run = `${info.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, "-");
  const email = `e2e-${run}@example.test`;
  const password = "senhaSegura123";
  const newPassword = "novaSenha456";
  try {
    await post(page, "/api/auth/signup", { name: "Cliente E2E", email, password });
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

test("customer session persists across reload, storefront modal, cart and demo checkout without new registration", async ({
  page,
  context,
}, info) => {
  const run = `${info.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, "-");
  const email = `checkout-${run}@example.test`;
  const password = "senhaSegura123";
  try {
    await page.goto("/conta/cadastro");
    const age = page.getByRole("button", { name: "Sim, tenho 18+" });
    if (await age.isVisible()) await age.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByLabel("Nome completo").fill("Helena Ficticia");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar senha").fill(password);
    await page.getByRole("checkbox", { name: /18 anos/ }).check();
    await page.getByRole("checkbox", { name: /termos de uso/ }).check();
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();

    await expect(page).toHaveURL(/\/conta$/);
    await expect(page.locator(".account-hello")).toContainText("Helena");
    const cookie = (await context.cookies()).find((c) => c.name === "th_customer_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    // Reload /conta — session persists.
    await page.reload();
    await expect(page.locator(".account-hello")).toContainText("Helena");

    // Update profile fields so checkout can also reuse phone, city and state.
    await page.goto("/conta/perfil");
    await page.locator("#profile-phone").fill("(11) 97777-6666");
    await page.locator("#profile-city").fill("Campinas");
    await page.locator("#profile-state").selectOption("SP");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.locator(".form-feedback")).toContainText("Dados atualizados na sua conta.");

    // Storefront page after reload recognizes the signed-in session (no login/signup prompt).
    await page.goto("/");
    await page.reload();
    if (info.project.name === "desktop") {
      await page.getByRole("button", { name: "Minha conta" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Helena Ficticia");
      await expect(dialog.getByRole("link", { name: "Ir para minha conta" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Criar conta" })).toHaveCount(0);
      await page.keyboard.press("Escape");
    }

    // Revisiting /conta/cadastro while signed in shows active session instead of new signup form.
    await page.goto("/conta/cadastro");
    await expect(page.locator(".auth-already-signed-in")).toContainText("Helena Ficticia");

    // Add item to cart and navigate to /checkout, then reload /checkout.
    await page.goto("/produto/case-compact-preto");
    await page
      .getByRole("button", { name: "Adicionar Case Compact Preto ao carrinho" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: /Finalizar pedido/ })
      .click();
    await expect(page).toHaveURL(/\/checkout$/);
    await page.reload();

    // Checkout reuses the authenticated session without requiring a new registration.
    await expect(page.locator(".checkout-account-banner")).toContainText("Helena Ficticia");
    await expect(page.locator(".checkout-account-banner")).toContainText(email);
    await expect(page.locator("#checkout-name")).toHaveValue("Helena Ficticia");
    await expect(page.locator("#checkout-email")).toHaveValue(email);
    await expect(page.locator("#checkout-phone")).toHaveValue("11977776666");
    await expect(page.locator("#checkout-city")).toHaveValue("Campinas");
    await expect(page.locator("#checkout-state")).toHaveValue("SP");

    // Fill only delivery address fields and complete the demonstrative order.
    await page.locator("#checkout-zip").fill("13010000");
    await page.locator("#checkout-address").fill("Rua Exemplo");
    await page.locator("#checkout-number").fill("250");
    await page
      .getByLabel("Entendo que este pedido é apenas uma demonstração.")
      .check();
    await page
      .getByRole("button", { name: "Finalizar pedido", exact: true })
      .click();

    await expect(page).toHaveURL(/\/pedido-confirmado$/);
    await expect(
      page.getByRole("heading", { name: "PEDIDO RECEBIDO." }),
    ).toBeVisible();

    // Privacy check: no credentials or PII persisted in browser storage.
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(stored).not.toContain(email);
    expect(stored).not.toContain("Helena Ficticia");
    expect(stored).not.toContain(password);
  } finally {
    await deleteCustomerByEmail(email);
  }
});
