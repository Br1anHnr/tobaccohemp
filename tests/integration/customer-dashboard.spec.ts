import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";

const ORIGIN = "http://127.0.0.1:3210";
const password = process.env.ADMIN_PASSWORD ?? "synthetic-integration-password";

function dbPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL obrigatória para testes de integração.");
  return new Pool({ connectionString: url, max: 2 });
}

async function login(page: Page) {
  const pool = dbPool();
  try {
    await pool.query("DELETE FROM admin_login_attempts");
  } finally {
    await pool.end();
  }
  const response = await page.request.post("/api/admin/auth/login", {
    headers: { Origin: ORIGIN },
    data: { email: "admin@example.test", password },
  });
  expect(response.status()).toBe(200);
}

async function deleteCustomerByEmail(email: string) {
  const pool = dbPool();
  try {
    await pool.query("DELETE FROM customer_accounts WHERE email = $1", [email]);
  } finally {
    await pool.end();
  }
}

test("cadastro de cliente reflete na lista e no KPI de clientes do admin", async ({ page }, info) => {
  const run = `${info.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, "-");
  const email = `admin-view-${run}@example.test`;
  try {
    const signup = await page.request.post("/api/auth/signup", {
      headers: { Origin: ORIGIN },
      data: { name: "Cliente Admin E2E", email, phone: "11988887777", password: "senhaSegura123" },
    });
    expect(signup.status()).toBe(201);
    expect((await signup.json()).data.passwordHash).toBeUndefined();

    await login(page);

    // A lista de clientes do admin deriva de customer_accounts (fonte única).
    const list = await page.request.get("/api/admin/customers");
    expect(list.status()).toBe(200);
    const rows = (await list.json()).data as Array<{ email: string; status: string; passwordHash?: string }>;
    const mine = rows.find(row => row.email === email);
    expect(mine).toBeTruthy();
    expect(mine?.status).toBe("active");
    expect(mine?.passwordHash).toBeUndefined();

    // O KPI "Clientes cadastrados" bate com a contagem real de customer_accounts.
    const dashboard = (await (await page.request.get("/api/admin/dashboard")).json()).data;
    const pool = dbPool();
    let sqlCount = -1;
    try {
      const res = await pool.query("SELECT count(*)::int AS n FROM customer_accounts");
      sqlCount = Number(res.rows[0].n);
    } finally {
      await pool.end();
    }
    expect(dashboard.customers).toBe(sqlCount);
    expect(dashboard.customers).toBeGreaterThanOrEqual(1);
  } finally {
    await deleteCustomerByEmail(email);
  }
});

test("séries do dashboard refletem pedidos demonstrativos e ficam vazias sem eles", async ({ page }, info) => {
  const run = `${info.project.name}-${Date.now()}`.replace(/[^A-Za-z0-9]/g, "-");
  const sku = `DSH-${run}`.toUpperCase().slice(0, 32);
  const createdOrderIds: string[] = [];
  const createdProductIds: string[] = [];

  try {
    await login(page);

    // Sem pedidos demonstrativos qualificados, as séries são explicitamente vazias.
    const pool0 = dbPool();
    try {
      await pool0.query("DELETE FROM orders");
    } finally {
      await pool0.end();
    }
    const emptyDashboard = (await (await page.request.get("/api/admin/dashboard")).json()).data;
    expect(emptyDashboard.salesSeries).toEqual([]);
    expect(emptyDashboard.categoryPerformance).toEqual([]);

    // Cria um produto elegível e um pedido demonstrativo que avança até "paid".
    const productRes = await page.request.post("/api/admin/products", {
      headers: { Origin: ORIGIN },
      data: { name: `Case Dashboard ${run}`, sku, priceCents: 4990, active: true, categorySlug: "cases" },
    });
    expect(productRes.status()).toBe(201);
    const productId = String((await productRes.json()).data.id);
    createdProductIds.push(productId);

    await page.request.patch(`/api/admin/inventory/${productId}`, {
      headers: { Origin: ORIGIN },
      data: { quantity: 10, reorderPoint: 1 },
    });

    const orderRes = await page.request.post("/api/admin/orders", {
      headers: { Origin: ORIGIN },
      data: {
        customerLabel: `Dashboard ${run}`,
        channel: "site",
        paymentMethod: "pix",
        idempotencyKey: `dsh-${run}`,
        items: [{ productId, quantity: 2 }],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = (await orderRes.json()).data;
    createdOrderIds.push(order.id);

    const paidRes = await page.request.patch(`/api/admin/orders/${order.id}`, {
      headers: { Origin: ORIGIN },
      data: { status: "paid", reason: "Confirmação sandbox" },
    });
    expect(paidRes.status()).toBe(200);

    // As séries passam a refletir o volume demonstrativo persistido.
    const dashboard = (await (await page.request.get("/api/admin/dashboard")).json()).data;
    expect(dashboard.salesSeries.length).toBe(14);
    const today = dashboard.salesSeries[dashboard.salesSeries.length - 1];
    expect(today.value).toBe(99.8); // 2 × R$ 49,90
    expect(dashboard.categoryPerformance).toContainEqual(
      expect.objectContaining({ label: expect.stringMatching(/case/i), value: 99.8 }),
    );

    // A soma da série diária confere com o SQL de volume demonstrativo.
    const pool = dbPool();
    let sqlVolumeCents = -1;
    try {
      const res = await pool.query(
        `SELECT COALESCE(SUM(total_cents), 0)::bigint AS cents FROM orders
          WHERE is_demo = true AND status IN ('paid', 'pending_payment')`,
      );
      sqlVolumeCents = Number(res.rows[0].cents);
    } finally {
      await pool.end();
    }
    const seriesTotal = dashboard.salesSeries.reduce((sum: number, point: { value: number }) => sum + point.value, 0);
    expect(seriesTotal).toBeCloseTo(sqlVolumeCents / 100, 2);
  } finally {
    const pool = dbPool();
    try {
      if (createdOrderIds.length) await pool.query("DELETE FROM orders WHERE id = ANY($1::text[])", [createdOrderIds]);
      if (createdProductIds.length) await pool.query("DELETE FROM products WHERE id = ANY($1::text[])", [createdProductIds]);
      await pool.query("DELETE FROM admin_login_attempts");
    } finally {
      await pool.end();
    }
  }
});
