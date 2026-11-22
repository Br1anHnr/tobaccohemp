import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";

const ORIGIN = "http://127.0.0.1:3210";
const password = process.env.ADMIN_PASSWORD ?? "synthetic-integration-password";

function dbPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL obrigatória para testes de integração.");
  return new Pool({ connectionString: url, max: 2 });
}

async function clearLoginThrottle() {
  const pool = dbPool();
  try {
    await pool.query("DELETE FROM admin_login_attempts");
  } finally {
    await pool.end();
  }
}

async function login(page: Page) {
  await clearLoginThrottle();
  const response = await page.request.post("/api/admin/auth/login", {
    headers: { Origin: ORIGIN },
    data: { email: "admin@example.test", password },
  });
  expect(response.status()).toBe(200);
  return String((await response.json()).data.id);
}

async function getInventoryQuantity(productId: string): Promise<number> {
  const pool = dbPool();
  try {
    const res = await pool.query("SELECT quantity FROM inventory WHERE product_id = $1", [productId]);
    if (!res.rows.length) {
      throw new Error(`Inventory row missing for productId=${productId}`);
    }
    return Number(res.rows[0].quantity);
  } finally {
    await pool.end();
  }
}

async function backdateOrderExpiration(orderId: string) {
  const pool = dbPool();
  try {
    await pool.query(
      "UPDATE orders SET expires_at = now() - interval '5 minutes' WHERE id = $1",
      [orderId],
    );
  } finally {
    await pool.end();
  }
}

async function cleanupFixtures(orderIds: string[], productIds: string[]) {
  if (!orderIds.length && !productIds.length) return;
  const pool = dbPool();
  try {
    if (orderIds.length) {
      await pool.query("DELETE FROM orders WHERE id = ANY($1::text[])", [orderIds]);
    }
    if (productIds.length) {
      await pool.query("DELETE FROM products WHERE id = ANY($1::text[])", [productIds]);
    }
    await pool.query("DELETE FROM admin_login_attempts");
  } finally {
    await pool.end();
  }
}

test("núcleo de pedidos garante consistência de estoque, idempotência, transições, expiração e histórico", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const run = `${info.project.name}-${Date.now()}`.replace(/[^A-Za-z0-9]/g, "-");
  const createdOrderIds: string[] = [];
  const createdProductIds: string[] = [];

  try {
    const adminId = await login(page);

    // 1. Cria produto elegível (cases) com estoque inicial 3.
    const eligibleRes = await page.request.post("/api/admin/products", {
      headers: { Origin: ORIGIN },
      data: {
        name: `Case Integração ${run}`,
        sku: `ORD-${run}`.toUpperCase().slice(0, 32),
        priceCents: 4990,
        active: true,
        categorySlug: "cases",
      },
    });
    expect(eligibleRes.status()).toBe(201);
    const eligibleProductId = String((await eligibleRes.json()).data.id);
    createdProductIds.push(eligibleProductId);

    const stockSet = await page.request.patch(`/api/admin/inventory/${eligibleProductId}`, {
      headers: { Origin: ORIGIN },
      data: { quantity: 3, reorderPoint: 1 },
    });
    expect(stockSet.status()).toBe(200);

    // 2. Cria produtos não elegíveis (sem categoria, inativo, termo regulado, arquivado).
    const uncategorizedRes = await page.request.post("/api/admin/products", {
      headers: { Origin: ORIGIN },
      data: {
        name: `Item Sem Categoria ${run}`,
        sku: `UNCAT-${run}`.toUpperCase().slice(0, 32),
        priceCents: 2990,
        active: true,
        categorySlug: null,
      },
    });
    expect(uncategorizedRes.status()).toBe(201);
    const uncategorizedId = String((await uncategorizedRes.json()).data.id);
    createdProductIds.push(uncategorizedId);
    await page.request.patch(`/api/admin/inventory/${uncategorizedId}`, {
      headers: { Origin: ORIGIN },
      data: { quantity: 5, reorderPoint: 1 },
    });

    const regulatedRes = await page.request.post("/api/admin/products", {
      headers: { Origin: ORIGIN },
      data: {
        name: `Pod Eletrônico ${run}`,
        sku: `REG-${run}`.toUpperCase().slice(0, 32),
        priceCents: 9990,
        active: true,
        categorySlug: "cases",
      },
    });
    expect(regulatedRes.status()).toBe(201);
    const regulatedId = String((await regulatedRes.json()).data.id);
    createdProductIds.push(regulatedId);
    await page.request.patch(`/api/admin/inventory/${regulatedId}`, {
      headers: { Origin: ORIGIN },
      data: { quantity: 5, reorderPoint: 1 },
    });

    const inactiveRes = await page.request.post("/api/admin/products", {
      headers: { Origin: ORIGIN },
      data: {
        name: `Case Inativo ${run}`,
        sku: `INACT-${run}`.toUpperCase().slice(0, 32),
        priceCents: 4990,
        active: false,
        categorySlug: "cases",
      },
    });
    expect(inactiveRes.status()).toBe(201);
    const inactiveId = String((await inactiveRes.json()).data.id);
    createdProductIds.push(inactiveId);
    await page.request.patch(`/api/admin/inventory/${inactiveId}`, {
      headers: { Origin: ORIGIN },
      data: { quantity: 5, reorderPoint: 1 },
    });

    const archivedRes = await page.request.post("/api/admin/products", {
      headers: { Origin: ORIGIN },
      data: {
        name: `Case Arquivado ${run}`,
        sku: `ARCH-${run}`.toUpperCase().slice(0, 32),
        priceCents: 4990,
        active: true,
        archived: true,
        categorySlug: "cases",
      },
    });
    expect(archivedRes.status()).toBe(201);
    const archivedId = String((await archivedRes.json()).data.id);
    createdProductIds.push(archivedId);
    await page.request.patch(`/api/admin/inventory/${archivedId}`, {
      headers: { Origin: ORIGIN },
      data: { quantity: 5, reorderPoint: 1 },
    });

    for (const blockedProductId of [uncategorizedId, regulatedId, inactiveId, archivedId]) {
      const blockedOrder = await page.request.post("/api/admin/orders", {
        headers: { Origin: ORIGIN },
        data: {
          channel: "site",
          paymentMethod: "pix",
          items: [{ productId: blockedProductId, quantity: 1 }],
        },
      });
      expect(blockedOrder.status()).toBe(422);
      expect(await getInventoryQuantity(blockedProductId)).toBe(5);
    }

    // 3. Soma multi-variante acima do estoque (2 + 2 > 3) é bloqueada sem baixar estoque.
    const overStock = await page.request.post("/api/admin/orders", {
      headers: { Origin: ORIGIN },
      data: {
        channel: "site",
        paymentMethod: "pix",
        items: [
          { productId: eligibleProductId, variant: "Preto", quantity: 2 },
          { productId: eligibleProductId, variant: "Grafite", quantity: 2 },
        ],
      },
    });
    expect(overStock.status()).toBe(422);
    expect(await getInventoryQuantity(eligibleProductId)).toBe(3);

    // 4. Prevenção de pedidos duplicados por Idempotency-Key (sequencial e concorrente).
    const idemKey = `idem-${run}`;
    const orderPayload = {
      customerLabel: `Cliente Idem ${run}`,
      channel: "site",
      paymentMethod: "pix",
      idempotencyKey: idemKey,
      items: [
        { productId: eligibleProductId, variant: "Preto", quantity: 1 },
        { productId: eligibleProductId, variant: "Grafite", quantity: 1 },
      ],
    };

    const [concurrentA, concurrentB] = await Promise.all([
      page.request.post("/api/admin/orders", {
        headers: { Origin: ORIGIN },
        data: orderPayload,
      }),
      page.request.post("/api/admin/orders", {
        headers: { Origin: ORIGIN },
        data: orderPayload,
      }),
    ]);
    expect(concurrentA.status()).toBe(201);
    expect(concurrentB.status()).toBe(201);
    const bodyA = (await concurrentA.json()).data;
    const bodyB = (await concurrentB.json()).data;
    expect(bodyA.id).toBe(bodyB.id);
    expect(bodyA.orderNumber).toBe(bodyB.orderNumber);
    expect(bodyA.stockStatus).toBe("reserved");
    expect(bodyA.totalCents).toBe(9980);
    createdOrderIds.push(bodyA.id);

    // Estoque deve ter sido reservado apenas 1 vez (3 - 2 = 1).
    expect(await getInventoryQuantity(eligibleProductId)).toBe(1);

    // Mesma chave com payload diferente retorna 409 IDEMPOTENCY_CONFLICT.
    const conflict = await page.request.post("/api/admin/orders", {
      headers: { Origin: ORIGIN },
      data: {
        ...orderPayload,
        items: [{ productId: eligibleProductId, variant: "Preto", quantity: 1 }],
      },
    });
    expect(conflict.status()).toBe(409);
    expect(await getInventoryQuantity(eligibleProductId)).toBe(1);

    // 5. Concorrência pelo último item em estoque (1 unidade): 1 vence, 1 falha; estoque não fica negativo.
    const [race1, race2] = await Promise.all([
      page.request.post("/api/admin/orders", {
        headers: { Origin: ORIGIN },
        data: {
          customerLabel: `Race 1 ${run}`,
          channel: "whatsapp_link",
          paymentMethod: "pix",
          idempotencyKey: `race1-${run}`,
          items: [{ productId: eligibleProductId, quantity: 1 }],
        },
      }),
      page.request.post("/api/admin/orders", {
        headers: { Origin: ORIGIN },
        data: {
          customerLabel: `Race 2 ${run}`,
          channel: "site",
          paymentMethod: "card",
          idempotencyKey: `race2-${run}`,
          items: [{ productId: eligibleProductId, quantity: 1 }],
        },
      }),
    ]);
    const raceStatuses = [race1.status(), race2.status()].sort();
    expect(raceStatuses).toEqual([201, 422]);
    const winnerBody = race1.status() === 201 ? (await race1.json()).data : (await race2.json()).data;
    createdOrderIds.push(winnerBody.id);
    expect(await getInventoryQuantity(eligibleProductId)).toBe(0);

    // 6. Transições válidas e inválidas + estorno devolve estoque.
    const paidRes = await page.request.patch(`/api/admin/orders/${bodyA.id}`, {
      headers: { Origin: ORIGIN },
      data: { status: "paid", reason: "Confirmação sandbox" },
    });
    expect(paidRes.status()).toBe(200);
    const paidOrder = (await paidRes.json()).data;
    expect(paidOrder.status).toBe("paid");
    expect(paidOrder.stockStatus).toBe("committed");
    expect(await getInventoryQuantity(eligibleProductId)).toBe(0);

    // Transição inválida paid -> canceled deve retornar 409.
    const invalidCancel = await page.request.patch(`/api/admin/orders/${bodyA.id}`, {
      headers: { Origin: ORIGIN },
      data: { status: "canceled" },
    });
    expect(invalidCancel.status()).toBe(409);

    // Estorno paid -> refunded deve restaurar as 2 unidades ao estoque.
    const refundRes = await page.request.patch(`/api/admin/orders/${bodyA.id}`, {
      headers: { Origin: ORIGIN },
      data: { status: "refunded", reason: "Estorno sandbox" },
    });
    expect(refundRes.status()).toBe(200);
    const refundedOrder = (await refundRes.json()).data;
    expect(refundedOrder.status).toBe("refunded");
    expect(refundedOrder.stockStatus).toBe("released");
    expect(refundedOrder.history.length).toBe(4);
    expect(await getInventoryQuantity(eligibleProductId)).toBe(2);

    // 7. Pedido vencido não pode ser marcado como pago e expiração automática libera estoque.
    await backdateOrderExpiration(winnerBody.id);
    const latePay = await page.request.patch(`/api/admin/orders/${winnerBody.id}`, {
      headers: { Origin: ORIGIN },
      data: { status: "paid" },
    });
    expect(latePay.status()).toBe(409);
    expect(await getInventoryQuantity(eligibleProductId)).toBe(2);

    const sweep = await page.request.post("/api/admin/orders/expire", {
      headers: { Origin: ORIGIN },
    });
    expect(sweep.status()).toBe(200);
    const sweepBody = (await sweep.json()).data;
    expect(sweepBody.expiredCount).toBeGreaterThanOrEqual(1);
    expect(await getInventoryQuantity(eligibleProductId)).toBe(3);

    // 7b. Cancelamento direto de pedido pending_payment também devolve o estoque reservado.
    const cancelTargetRes = await page.request.post("/api/admin/orders", {
      headers: { Origin: ORIGIN },
      data: {
        customerLabel: `Cancelamento Direto ${run}`,
        channel: "site",
        paymentMethod: "pix",
        idempotencyKey: `cancel-${run}`,
        items: [{ productId: eligibleProductId, quantity: 2 }],
      },
    });
    expect(cancelTargetRes.status()).toBe(201);
    const cancelTarget = (await cancelTargetRes.json()).data;
    createdOrderIds.push(cancelTarget.id);
    expect(await getInventoryQuantity(eligibleProductId)).toBe(1);

    const canceledRes = await page.request.patch(`/api/admin/orders/${cancelTarget.id}`, {
      headers: { Origin: ORIGIN },
      data: { status: "canceled", reason: "Cancelado antes do pagamento" },
    });
    expect(canceledRes.status()).toBe(200);
    const canceledOrder = (await canceledRes.json()).data;
    expect(canceledOrder.status).toBe("canceled");
    expect(canceledOrder.stockStatus).toBe("released");
    expect(await getInventoryQuantity(eligibleProductId)).toBe(3);

    // 8. Histórico consolidado administrativo e visualização no painel /admin/pedidos.
    const historyFeed = await page.request.get("/api/admin/orders/history?limit=20");
    expect(historyFeed.status()).toBe(200);
    const entries = (await historyFeed.json()).data as Array<{ orderId: string; reason: string }>;
    expect(entries.some((e) => e.orderId === bodyA.id && e.reason === "Estorno sandbox")).toBe(true);

    await page.goto("/admin/pedidos");
    await expect(page.getByRole("heading", { name: /Pedidos/ })).toBeVisible();
    await page.getByRole("button", { name: `Ver detalhes do pedido ${bodyA.orderNumber}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Estoque devolvido");
    await expect(dialog).toContainText("Estorno sandbox");
    await expect(dialog).toContainText(adminId);
    await dialog.getByRole("button", { name: "Fechar" }).click();
  } finally {
    await cleanupFixtures(createdOrderIds, createdProductIds);
  }
});
