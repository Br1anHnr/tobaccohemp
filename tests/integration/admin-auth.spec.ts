import { test, expect } from "@playwright/test";
import { Pool } from "pg";

// Admin RBAC, individual accounts and revocable sessions against the real
// PostgreSQL backend. The bootstrap admin comes from ADMIN_EMAIL/ADMIN_PASSWORD
// (seeded by ensureSchema); operators are created through the admin-only API.
const ORIGIN = "http://127.0.0.1:3210";
const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.test";
const adminPassword = process.env.ADMIN_PASSWORD ?? "synthetic-integration-password";

async function deleteAccount(email: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    // admin_sessions rows are removed by the FK cascade.
    await pool.query("DELETE FROM admin_accounts WHERE email = $1", [email]);
  } finally {
    await pool.end();
  }
}

test("contas individuais com hash, RBAC e sessões revogáveis", async ({ page, browser }, info) => {
  const run = `${info.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, "-");
  const operatorEmail = `operador-${run}@example.test`;
  const operatorPassword = "operadorSeguro123";

  try {
    // All newly integrated order endpoints enforce authorization before input or lookup.
    for (const path of ["/api/admin/orders", "/api/admin/orders/missing", "/api/admin/orders/history", "/api/admin/accounts"]) {
      expect((await page.request.get(path)).status()).toBe(401);
    }
    for (const path of ["/api/admin/orders", "/api/admin/orders/expire"]) {
      expect((await page.request.post(path, { headers: { Origin: ORIGIN }, data: {} })).status()).toBe(401);
    }
    expect((await page.request.patch("/api/admin/orders/missing", {
      headers: { Origin: ORIGIN }, data: { status: "paid" },
    })).status()).toBe(401);
    // Bootstrap admin logs in through the UI contract.
    const adminLogin = await page.request.post("/api/admin/auth/login", {
      headers: { Origin: ORIGIN },
      data: { email: adminEmail, password: adminPassword },
    });
    expect(adminLogin.status()).toBe(200);
    expect((await adminLogin.json()).data.role).toBe("admin");

    // Only an admin can list accounts.
    expect((await page.request.get("/api/admin/accounts")).status()).toBe(200);

    // Create an operator account (bcrypt-hashed password, never returned).
    const created = await page.request.post("/api/admin/accounts", {
      headers: { Origin: ORIGIN },
      data: { name: "Operador E2E", email: operatorEmail, password: operatorPassword, role: "operator" },
    });
    expect(created.status()).toBe(201);
    const operator = (await created.json()).data;
    expect(operator.role).toBe("operator");
    expect(operator.active).toBe(true);
    expect(operator.passwordHash).toBeUndefined();
    expect(operator.createdAt).toBeTruthy();

    // The operator signs in on an isolated context (own cookie jar).
    const operatorContext = await browser.newContext();
    const operatorLogin = await operatorContext.request.post("/api/admin/auth/login", {
      headers: { Origin: ORIGIN },
      data: { email: operatorEmail, password: operatorPassword },
    });
    expect(operatorLogin.status()).toBe(200);
    expect((await operatorLogin.json()).data.role).toBe("operator");

    // Read-only endpoints are available to operators.
    expect((await operatorContext.request.get("/api/admin/dashboard")).status()).toBe(200);
    expect((await operatorContext.request.get("/api/admin/products")).status()).toBe(200);
    expect((await operatorContext.request.get("/api/admin/orders")).status()).toBe(200);
    expect((await operatorContext.request.get("/api/admin/orders/history")).status()).toBe(200);
    expect((await operatorContext.request.get("/api/admin/orders/missing")).status()).toBe(404);
    for (const path of ["/api/admin/orders", "/api/admin/orders/expire"]) {
      expect((await operatorContext.request.post(path, {
        headers: { Origin: ORIGIN }, data: {},
      })).status()).toBe(403);
    }
    expect((await operatorContext.request.patch("/api/admin/orders/missing", {
      headers: { Origin: ORIGIN }, data: { status: "paid" },
    })).status()).toBe(403);
    expect((await page.request.post("/api/admin/orders/expire", {
      headers: { Origin: "https://invalid.example.test" },
    })).status()).toBe(403);

    // Mutations and account management stay admin-only.
    expect((await operatorContext.request.post("/api/admin/products", {
      headers: { Origin: ORIGIN },
      data: { name: "Bloqueado", sku: `OP-${run}`, priceCents: 1000 },
    })).status()).toBe(403);
    expect((await operatorContext.request.get("/api/admin/accounts")).status()).toBe(403);
    expect((await operatorContext.request.patch(`/api/admin/accounts/${operator.id}`, {
      headers: { Origin: ORIGIN },
      data: { active: false },
    })).status()).toBe(403);

    // Deactivating the account revokes every session immediately.
    const deactivated = await page.request.patch(`/api/admin/accounts/${operator.id}`, {
      headers: { Origin: ORIGIN },
      data: { active: false },
    });
    expect(deactivated.status()).toBe(200);
    expect((await deactivated.json()).data.active).toBe(false);

    expect((await (await operatorContext.request.get("/api/admin/auth/session")).json()).data).toBeNull();
    expect((await operatorContext.request.get("/api/admin/dashboard")).status()).toBe(401);
    await operatorContext.close();
  } finally {
    await deleteAccount(operatorEmail);
  }
});
