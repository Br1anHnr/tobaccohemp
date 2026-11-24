import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  AdminOrderSummary,
  CreateOrderInput,
  Order,
  OrderActorType,
  OrderChannel,
  OrderDetail,
  OrderEligibilityStatus,
  OrderItem,
  OrderPaymentMethod,
  OrderStatus,
  OrderStatusHistoryEntry,
  OrderStockStatus,
  PaymentProviderId,
  StockMovement,
} from "@/shared/contracts/orders";
import { pool, type Db } from "@/shared/server/database";
import { AdminError, missing } from "@/shared/server/validation";
import {
  calculateLineTotalCents,
  calculateOrderTotals,
  generateOrderNumber,
} from "../domain/calculations";
import { evaluateOrderEligibility, ONLINE_COMMERCE_POLICY } from "../domain/eligibility";
import { createOrderInput, updateOrderStatusInput } from "../domain/order-input";
import { assertOrderTransition, ORDER_STATUS_LABEL } from "../domain/order-status";
import { getPaymentProvider } from "../domain/payment-provider";

const DEMO_EXPIRATION_MS = 30 * 60 * 1000;

export interface OrderHistoryFeedEntry extends OrderStatusHistoryEntry {
  orderNumber: string;
  customerLabel: string;
}

export interface CustomerOrderDetail extends OrderDetail {
  attemptState?: string | null;
  lastProviderStatus?: string | null;
  detailPath?: string;
}

function isPoolClient(db: Db): db is PoolClient {
  return "release" in db && typeof (db as PoolClient).release === "function";
}

async function withTransaction<T>(
  db: Db,
  operation: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  if (isPoolClient(db)) {
    return operation(db);
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      return Object.keys(obj).length > 0 ? obj : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function buildRequestFingerprint(input: CreateOrderInput): string {
  const canonical = {
    customerAccountId: input.customerAccountId ?? null,
    customerLabel: input.customerLabel ?? "Pedido demonstrativo",
    channel: input.channel,
    paymentMethod: input.paymentMethod,
    shippingCents: input.shippingCents ?? 0,
    discountCents: input.discountCents ?? 0,
    items: [...input.items]
      .map((item) => ({
        productId: item.productId,
        variant: item.variant ?? "",
        quantity: item.quantity,
      }))
      .sort((a, b) =>
        a.productId === b.productId
          ? a.variant.localeCompare(b.variant)
          : a.productId.localeCompare(b.productId),
      ),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function mapOrderRow(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    customerAccountId:
      row.customer_account_id === null ? null : String(row.customer_account_id),
    customerLabel: String(row.customer_label),
    status: String(row.status) as OrderStatus,
    channel: String(row.channel) as OrderChannel,
    paymentProvider: String(row.payment_provider) as PaymentProviderId,
    paymentMethod: String(row.payment_method) as OrderPaymentMethod,
    providerReference:
      row.provider_reference === null ? null : String(row.provider_reference),
    checkoutUrl: row.checkout_url === null ? null : String(row.checkout_url),
    subtotalCents: Number(row.subtotal_cents),
    shippingCents: Number(row.shipping_cents),
    discountCents: Number(row.discount_cents),
    totalCents: Number(row.total_cents),
    currency: "BRL",
    isDemo: row.is_demo === true,
    eligibilityStatus: String(row.eligibility_status) as OrderEligibilityStatus,
    stockStatus: (row.stock_status
      ? String(row.stock_status)
      : "none") as OrderStockStatus,
    stockReservedAt:
      row.stock_reserved_at == null ? null : toIso(row.stock_reserved_at),
    stockReleasedAt:
      row.stock_released_at == null ? null : toIso(row.stock_released_at),
    expiresAt: row.expires_at === null ? null : toIso(row.expires_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapOrderItemRow(row: Record<string, unknown>): OrderItem {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    productId: String(row.product_id),
    sku: String(row.sku),
    productName: String(row.product_name),
    categorySlug: String(row.category_slug),
    variant: String(row.variant ?? ""),
    quantity: Number(row.quantity),
    unitPriceCents: Number(row.unit_price_cents),
    lineTotalCents: Number(row.line_total_cents),
    eligible: row.eligible === true,
  };
}

function mapHistoryRow(row: Record<string, unknown>): OrderStatusHistoryEntry {
  const metadata = parseMetadata(row.metadata_json);
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    fromStatus:
      row.from_status === null ? null : (String(row.from_status) as OrderStatus),
    toStatus: String(row.to_status) as OrderStatus,
    reason: String(row.reason),
    actorType: String(row.actor_type) as OrderActorType,
    actorId: row.actor_id === null ? null : String(row.actor_id),
    ...(metadata ? { metadata } : {}),
    createdAt: toIso(row.created_at),
  };
}

export async function listOrders(db: Db = pool()): Promise<Order[]> {
  const result = await db.query(
    `SELECT id, order_number, customer_account_id, customer_label, status, channel,
            payment_provider, payment_method, provider_reference, checkout_url,
            subtotal_cents, shipping_cents, discount_cents, total_cents, currency,
            is_demo, eligibility_status, stock_status, stock_reserved_at, stock_released_at,
            expires_at, created_at, updated_at
       FROM orders
      ORDER BY created_at DESC, id DESC`,
  );
  return result.rows.map((row) => mapOrderRow(row as Record<string, unknown>));
}

export async function getOrderDetail(id: string, db: Db = pool()): Promise<OrderDetail> {
  const orderRes = await db.query(
    `SELECT id, order_number, customer_account_id, customer_label, status, channel,
            payment_provider, payment_method, provider_reference, checkout_url,
            subtotal_cents, shipping_cents, discount_cents, total_cents, currency,
            is_demo, eligibility_status, stock_status, stock_reserved_at, stock_released_at,
            expires_at, created_at, updated_at
       FROM orders
      WHERE id = $1`,
    [id],
  );
  if (!orderRes.rows.length) missing();

  const [itemsRes, historyRes] = await Promise.all([
    db.query(
      `SELECT id, order_id, product_id, sku, product_name, category_slug, variant,
              quantity, unit_price_cents, line_total_cents, eligible
         FROM order_items
        WHERE order_id = $1
        ORDER BY id ASC`,
      [id],
    ),
    db.query(
      `SELECT id, order_id, from_status, to_status, reason, actor_type, actor_id,
              metadata_json, created_at
         FROM order_status_history
        WHERE order_id = $1
        ORDER BY created_at ASC, id ASC`,
      [id],
    ),
  ]);

  return {
    ...mapOrderRow(orderRes.rows[0] as Record<string, unknown>),
    items: itemsRes.rows.map((row) => mapOrderItemRow(row as Record<string, unknown>)),
    history: historyRes.rows.map((row) => mapHistoryRow(row as Record<string, unknown>)),
  };
}

export async function listOrderHistory(
  limit = 50,
  db: Db = pool(),
): Promise<OrderHistoryFeedEntry[]> {
  const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;
  const result = await db.query(
    `SELECT h.id, h.order_id, h.from_status, h.to_status, h.reason, h.actor_type,
            h.actor_id, h.metadata_json, h.created_at, o.order_number, o.customer_label
       FROM order_status_history h
       JOIN orders o ON o.id = h.order_id
      WHERE o.is_demo = true AND o.payment_provider = 'demo'
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT $1`,
    [safeLimit],
  );
  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      ...mapHistoryRow(r),
      orderNumber: String(r.order_number),
      customerLabel: String(r.customer_label),
    };
  });
}

export async function listCustomerOrders(
  customerAccountId: string,
  db: Db = pool(),
): Promise<CustomerOrderDetail[]> {
  const ordersRes = await db.query(
    `SELECT o.id, o.order_number, o.customer_account_id, o.customer_label, o.status, o.channel,
            o.payment_provider, o.payment_method, o.provider_reference, o.checkout_url,
            o.subtotal_cents, o.shipping_cents, o.discount_cents, o.total_cents, o.currency,
            o.is_demo, o.eligibility_status, o.stock_status, o.stock_reserved_at, o.stock_released_at,
            o.expires_at, o.created_at, o.updated_at,
            a.state AS attempt_state, a.last_provider_status
       FROM orders o
       LEFT JOIN asaas_sandbox_attempts a ON a.order_id = o.id
      WHERE o.customer_account_id = $1
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT 50`,
    [customerAccountId],
  );
  if (!ordersRes.rows.length) return [];

  const orderIds = ordersRes.rows.map((row) => String(row.id));
  const [itemsRes, historyRes] = await Promise.all([
    db.query(
      `SELECT id, order_id, product_id, sku, product_name, category_slug, variant,
              quantity, unit_price_cents, line_total_cents, eligible
         FROM order_items
        WHERE order_id = ANY($1::text[])
        ORDER BY id ASC`,
      [orderIds],
    ),
    db.query(
      `SELECT id, order_id, from_status, to_status, reason, actor_type, actor_id,
              metadata_json, created_at
         FROM order_status_history
        WHERE order_id = ANY($1::text[])
        ORDER BY created_at ASC, id ASC`,
      [orderIds],
    ),
  ]);

  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const row of itemsRes.rows) {
    const item = mapOrderItemRow(row as Record<string, unknown>);
    const list = itemsByOrder.get(item.orderId);
    if (list) list.push(item);
    else itemsByOrder.set(item.orderId, [item]);
  }

  const historyByOrder = new Map<string, OrderStatusHistoryEntry[]>();
  for (const row of historyRes.rows) {
    const entry = mapHistoryRow(row as Record<string, unknown>);
    const list = historyByOrder.get(entry.orderId);
    if (list) list.push(entry);
    else historyByOrder.set(entry.orderId, [entry]);
  }

  return ordersRes.rows.map((row) => {
    const r = row as Record<string, unknown>;
    const order = mapOrderRow(r);
    return {
      ...order,
      attemptState: r.attempt_state == null ? null : String(r.attempt_state),
      lastProviderStatus:
        r.last_provider_status == null ? null : String(r.last_provider_status),
      items: itemsByOrder.get(order.id) ?? [],
      history: historyByOrder.get(order.id) ?? [],
    };
  });
}

export async function createOrder(
  value: unknown,
  actor: { actorType: OrderActorType; actorId?: string | null },
  db: Db = pool(),
  sandbox = false,
): Promise<OrderDetail> {
  if (ONLINE_COMMERCE_POLICY.realPaymentsEnabled) {
    throw new AdminError(
      403,
      "REAL_CHARGE_DISABLED",
      "Cobranças reais não estão habilitadas nesta etapa.",
    );
  }

  const input = createOrderInput(value);
  const fingerprint = buildRequestFingerprint(input);
  const provider = getPaymentProvider("demo");
  if (!provider.isSandboxOnly) {
    throw new AdminError(
      403,
      "REAL_CHARGE_DISABLED",
      "Somente provedores demonstrativos/sandbox são permitidos nesta etapa.",
    );
  }

  return withTransaction(db, async (tx) => {
    if (input.idempotencyKey) {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        input.idempotencyKey,
      ]);
      const existing = await tx.query(
        "SELECT id, request_fingerprint FROM orders WHERE idempotency_key = $1",
        [input.idempotencyKey],
      );
      if (existing.rows.length > 0) {
        const storedFingerprint = String(existing.rows[0].request_fingerprint ?? "");
        if (storedFingerprint !== fingerprint) {
          throw new AdminError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Chave de idempotência já utilizada para outro pedido com dados diferentes.",
          );
        }
        return getOrderDetail(String(existing.rows[0].id), tx);
      }
    }

    if (input.customerAccountId) {
      const customerRes = await tx.query(
        "SELECT id FROM customer_accounts WHERE id = $1",
        [input.customerAccountId],
      );
      if (!customerRes.rows.length) {
        throw new AdminError(
          404,
          "CUSTOMER_NOT_FOUND",
          "Conta de cliente informada não foi encontrada.",
        );
      }
    }

    const sortedProductIds = Array.from(
      new Set(input.items.map((item) => item.productId)),
    ).sort();

    // Lock product rows first in deterministic order to avoid deadlocks.
    const productsRes = await tx.query(
      `SELECT id, sku, name, category_slug, price_cents, active, archived_at, tags, variants
         FROM products
        WHERE id = ANY($1::text[])
        ORDER BY id ASC
        FOR UPDATE`,
      [sortedProductIds],
    );

    const productById = new Map<
      string,
      {
        id: string;
        sku: string;
        name: string;
        categorySlug: string | null;
        priceCents: number;
        active: boolean;
        archived: boolean;
        tags: string[];
        variants: string[];
      }
    >();

    for (const row of productsRes.rows) {
      const r = row as Record<string, unknown>;
      productById.set(String(r.id), {
        id: String(r.id),
        sku: String(r.sku),
        name: String(r.name),
        categorySlug: r.category_slug === null ? null : String(r.category_slug),
        priceCents: Number(r.price_cents),
        active: r.active === true,
        archived: r.archived_at !== null,
        tags: asStringArray(r.tags),
        variants: asStringArray(r.variants),
      });
    }

    const existingProductIds = Array.from(productById.keys()).sort();
    if (existingProductIds.length > 0) {
      await tx.query(
        `INSERT INTO inventory (product_id, quantity, reorder_point, updated_at)
         SELECT id, 0, 0, created_at
           FROM products
          WHERE id = ANY($1::text[])
         ON CONFLICT (product_id) DO NOTHING`,
        [existingProductIds],
      );
    }

    const inventoryRes =
      existingProductIds.length > 0
        ? await tx.query(
            `SELECT product_id, quantity
               FROM inventory
              WHERE product_id = ANY($1::text[])
              ORDER BY product_id ASC
              FOR UPDATE`,
            [existingProductIds],
          )
        : { rows: [] };

    const stockById = new Map<string, number>();
    for (const row of inventoryRes.rows) {
      const r = row as Record<string, unknown>;
      stockById.set(String(r.product_id), Number(r.quantity));
    }

    const resolvedEntries = input.items.map((item) => {
      const dbProduct = productById.get(item.productId);
      if (sandbox && item.variant && dbProduct && !dbProduct.variants.includes(item.variant)) {
        throw new AdminError(422, "INVALID_VARIANT", `Variação indisponível para "${dbProduct.name}".`);
      }
      const subject = dbProduct
        ? {
            id: dbProduct.id,
            name: dbProduct.name,
            sku: dbProduct.sku,
            categorySlug: dbProduct.categorySlug,
            active: dbProduct.active,
            archived: dbProduct.archived,
            stock: stockById.get(dbProduct.id) ?? 0,
            tags: dbProduct.tags,
          }
        : undefined;
      return {
        requested: sandbox && !item.variant && dbProduct?.variants[0]
          ? { ...item, variant: dbProduct.variants[0] }
          : item,
        dbProduct,
        subject,
      };
    });

    const eligibility = evaluateOrderEligibility(
      resolvedEntries.map((entry) => ({
        product: entry.subject,
        quantity: entry.requested.quantity,
      })),
    );
    if (!eligibility.allowed) {
      throw new AdminError(
        422,
        "INELIGIBLE_ORDER",
        eligibility.blockedReasons[0] ?? "Pedido não elegível para checkout.",
      );
    }

    const now = new Date();
    const createdAt = now.toISOString();
    const intentAt = new Date(now.getTime() + 1).toISOString();
    const expiresAt = new Date(now.getTime() + DEMO_EXPIRATION_MS).toISOString();

    // Aggregate quantities per productId and reserve stock atomically in sorted order.
    const qtyByProduct = new Map<string, number>();
    const stockMovements: StockMovement[] = [];
    for (const item of input.items) {
      qtyByProduct.set(
        item.productId,
        (qtyByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    for (const productId of sortedProductIds) {
      const reserveQty = qtyByProduct.get(productId) ?? 0;
      const updated = await tx.query(
        `UPDATE inventory
            SET quantity = quantity - $1, updated_at = $2
          WHERE product_id = $3 AND quantity >= $1
          RETURNING quantity`,
        [reserveQty, createdAt, productId],
      );
      if (!updated.rows.length) {
        const productName = productById.get(productId)?.name ?? productId;
        throw new AdminError(
          409,
          "INSUFFICIENT_STOCK",
          `Estoque insuficiente para reservar "${productName}".`,
        );
      }
      const after = Number(updated.rows[0].quantity);
      stockMovements.push({ productId, before: after + reserveQty, after });
    }

    const frozenItems = resolvedEntries.map((entry) => {
      const product = entry.dbProduct!;
      const unitPriceCents = product.priceCents;
      const quantity = entry.requested.quantity;
      return {
        id: randomUUID(),
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        categorySlug: product.categorySlug!,
        variant: entry.requested.variant ?? "",
        quantity,
        unitPriceCents,
        lineTotalCents: calculateLineTotalCents(unitPriceCents, quantity),
        eligible: true,
      };
    });

    const totals = calculateOrderTotals(
      frozenItems,
      input.shippingCents ?? 0,
      input.discountCents ?? 0,
    );
    if (sandbox && totals.totalCents <= 0) throw new AdminError(422, "SANDBOX_AMOUNT", "O pedido Sandbox deve ter valor positivo.");

    const orderId = randomUUID();
    const orderNumber = generateOrderNumber();

    const intent = sandbox ? {
      provider: "asaas" as const,
      providerReference: null,
      checkoutUrl: null,
      status: "pending_payment" as const,
      notice: "Tentativa Asaas Sandbox registrada; aguardando confirmação pelo provedor.",
    } : provider.createPaymentIntent({
      orderNumber,
      amountCents: totals.totalCents,
      currency: "BRL",
      channel: input.channel,
      method: input.paymentMethod,
      isDemo: true,
      expiresAt,
    });

    await tx.query(
      `INSERT INTO orders (
         id, order_number, customer_account_id, customer_label, status, channel,
         payment_provider, payment_method, provider_reference, checkout_url,
         subtotal_cents, shipping_cents, discount_cents, total_cents, currency,
         is_demo, eligibility_status, idempotency_key, request_fingerprint,
         stock_status, stock_reserved_at, stock_released_at,
         expires_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13, $14, 'BRL',
         $15, $16, $17, $18,
         'reserved', $19, NULL,
         $20, $21, $22
       )`,
      [
        orderId,
        orderNumber,
        input.customerAccountId ?? null,
        input.customerLabel ?? "Pedido demonstrativo",
        intent.status,
        input.channel,
        sandbox ? "asaas" : intent.provider,
        input.paymentMethod,
        sandbox ? null : intent.providerReference,
        sandbox ? null : intent.checkoutUrl,
        totals.subtotalCents,
        totals.shippingCents,
        totals.discountCents,
        totals.totalCents,
        !sandbox,
        eligibility.eligibilityStatus,
        input.idempotencyKey ?? null,
        fingerprint,
        createdAt,
        expiresAt,
        createdAt,
        intentAt,
      ],
    );

    for (const item of frozenItems) {
      await tx.query(
        `INSERT INTO order_items (
           id, order_id, product_id, sku, product_name, category_slug,
           variant, quantity, unit_price_cents, line_total_cents, eligible
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          item.id,
          orderId,
          item.productId,
          item.sku,
          item.productName,
          item.categorySlug,
          item.variant,
          item.quantity,
          item.unitPriceCents,
          item.lineTotalCents,
          item.eligible,
        ],
      );
    }

    const draftMeta = JSON.stringify({
      stockAction: "reserved",
      stockStatus: "reserved",
      reservedQuantities: Array.from(qtyByProduct.entries()).map(
        ([productId, quantity]) => ({ productId, quantity }),
      ),
      stockMovements,
    });
    const intentMeta = JSON.stringify({
      provider: intent.provider,
      providerReference: intent.providerReference,
      channel: input.channel,
      paymentMethod: input.paymentMethod,
      stockStatus: "reserved",
    });

    await tx.query(
      `INSERT INTO order_status_history (
         id, order_id, from_status, to_status, reason, actor_type, actor_id, metadata_json, created_at
       ) VALUES ($1, $2, NULL, 'draft', $3, $4, $5, $6, $7),
                ($8, $2, 'draft', $9, $10, 'system', $11, $12, $13)`,
      [
        randomUUID(),
        orderId,
        sandbox ? "Pedido Asaas Sandbox criado com preços congelados e estoque sintético reservado." : "Pedido demonstrativo criado com preços congelados e estoque reservado.",
        actor.actorType,
        actor.actorId ?? null,
        draftMeta,
        createdAt,
        randomUUID(),
        intent.status,
        sandbox ? "Tentativa Asaas Sandbox registrada; aguardando confirmação pelo provedor." : intent.notice,
        sandbox ? "asaas" : intent.provider,
        intentMeta,
        intentAt,
      ],
    );

    return getOrderDetail(orderId, tx);
  });
}

async function applyStatusTransition(
  tx: PoolClient,
  id: string,
  toStatus: OrderStatus,
  reasonInput: string | undefined,
  actor: { actorType: OrderActorType; actorId?: string | null },
  extraMetadata: Record<string, unknown> = {},
  sandboxReconciliation = false,
): Promise<OrderDetail> {
  const currentRes = await tx.query(
    "SELECT status, expires_at, stock_status FROM orders WHERE id = $1 FOR UPDATE",
    [id],
  );
  if (!currentRes.rows.length) missing();

  const row = currentRes.rows[0] as Record<string, unknown>;
  const fromStatus = String(row.status) as OrderStatus;
  const currentStockStatus = (
    row.stock_status ? String(row.stock_status) : "none"
  ) as OrderStockStatus;
  const expiresAt = row.expires_at === null ? null : toIso(row.expires_at);

  if (fromStatus === toStatus && sandboxReconciliation) return getOrderDetail(id, tx);
  if (!(sandboxReconciliation && (
    (toStatus === "paid" && ["expired", "canceled"].includes(fromStatus)) ||
    (toStatus === "refunded" && ["pending_payment", "expired", "canceled"].includes(fromStatus))
  ))) assertOrderTransition(fromStatus, toStatus);

  if (
    !sandboxReconciliation && fromStatus === "pending_payment" &&
    toStatus === "paid" &&
    expiresAt !== null &&
    new Date(expiresAt).getTime() <= Date.now()
  ) {
    throw new AdminError(
      409,
      "ORDER_EXPIRED",
      "O prazo de pagamento do pedido expirou; marque-o como expirado ou cancelado.",
    );
  }

  const now = new Date().toISOString();
  let nextStockStatus: OrderStockStatus = currentStockStatus;
  let stockAction: "none" | "committed" | "released" = "none";
  let releasedAt: string | null = null;
  const releasedItems: Array<{ productId: string; quantity: number }> = [];
  const stockMovements: StockMovement[] = [];

  // A late, provider-confirmed payment must reacquire a released reservation.
  // The enclosing transaction rolls back every row if any item is unavailable.
  if (sandboxReconciliation && toStatus === "paid" && currentStockStatus === "released") {
    const items = await tx.query("SELECT product_id, SUM(quantity)::int AS qty FROM order_items WHERE order_id=$1 GROUP BY product_id ORDER BY product_id", [id]);
    await tx.query("SELECT product_id FROM inventory WHERE product_id=ANY($1::text[]) ORDER BY product_id FOR UPDATE", [items.rows.map(r => r.product_id)]);
    for (const item of items.rows) {
      const result = await tx.query("UPDATE inventory SET quantity=quantity-$1, updated_at=$2 WHERE product_id=$3 AND quantity >= $1 RETURNING quantity", [item.qty, now, item.product_id]);
      if (!result.rows.length) throw new AdminError(409, "LATE_PAYMENT_STOCK_REVIEW", "Pagamento tardio exige revisão de estoque.");
      const after = Number(result.rows[0].quantity);
      stockMovements.push({ productId: item.product_id, before: after + Number(item.qty), after });
    }
    nextStockStatus = "committed";
    stockAction = "committed";
  }

  if (toStatus === "paid" && currentStockStatus === "reserved") {
    nextStockStatus = "committed";
    stockAction = "committed";
  } else if (
    (toStatus === "canceled" || toStatus === "expired" || toStatus === "refunded") &&
    (currentStockStatus === "reserved" || currentStockStatus === "committed")
  ) {
    const itemsRes = await tx.query(
      `SELECT product_id, SUM(quantity)::int AS qty
         FROM order_items
        WHERE order_id = $1
        GROUP BY product_id
        ORDER BY product_id ASC`,
      [id],
    );
    const productIds = itemsRes.rows.map((itemRow) => String(itemRow.product_id));
    if (productIds.length > 0) {
      await tx.query(
        `SELECT product_id
           FROM inventory
          WHERE product_id = ANY($1::text[])
          ORDER BY product_id ASC
          FOR UPDATE`,
        [productIds],
      );
      for (const itemRow of itemsRes.rows) {
        const productId = String(itemRow.product_id);
        const qty = Number(itemRow.qty);
        const result = await tx.query(
          "UPDATE inventory SET quantity = quantity + $1, updated_at = $2 WHERE product_id = $3 RETURNING quantity",
          [qty, now, productId],
        );
        if (!result.rows.length) throw new AdminError(409, "INVENTORY_MISSING", "Estoque do pedido indisponível para devolução.");
        const after = Number(result.rows[0].quantity);
        stockMovements.push({ productId, before: after - qty, after });
        releasedItems.push({ productId, quantity: qty });
      }
    }
    nextStockStatus = "released";
    stockAction = "released";
    releasedAt = now;
  }

  const reason =
    reasonInput ??
    `Status atualizado de "${ORDER_STATUS_LABEL[fromStatus]}" para "${ORDER_STATUS_LABEL[toStatus]}".`;

  await tx.query(
    `UPDATE orders
        SET status = $1,
            stock_status = $2,
            stock_released_at = COALESCE($3, stock_released_at),
            updated_at = $4
      WHERE id = $5`,
    [toStatus, nextStockStatus, releasedAt, now, id],
  );

  const metadata = JSON.stringify({
    ...extraMetadata,
    stockAction,
    stockStatus: nextStockStatus,
    ...(releasedItems.length > 0 ? { releasedItems } : {}),
    ...(stockMovements.length > 0 ? { stockMovements } : {}),
  });

  await tx.query(
    `INSERT INTO order_status_history (
       id, order_id, from_status, to_status, reason, actor_type, actor_id, metadata_json, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      randomUUID(),
      id,
      fromStatus,
      toStatus,
      reason,
      actor.actorType,
      actor.actorId ?? null,
      metadata,
      now,
    ],
  );

  return getOrderDetail(id, tx);
}

export async function transitionOrderStatus(
  id: string,
  value: unknown,
  actor: { actorType: OrderActorType; actorId?: string | null },
  db: Db = pool(),
): Promise<OrderDetail> {
  const input = updateOrderStatusInput(value);
  return withTransaction(db, async (tx) => {
    const order = await tx.query("SELECT payment_provider FROM orders WHERE id=$1 FOR UPDATE", [id]);
    if (order.rows[0]?.payment_provider === "asaas") throw new AdminError(409, "PROVIDER_MANAGED", "Pedidos Asaas exigem reconciliação com o provedor.");
    return applyStatusTransition(tx, id, input.status, input.reason, actor);
  });
}

/** Internal provider boundary: caller already verified the provider response. */
export async function reconcileSandboxOrder(tx: PoolClient, id: string, status: OrderStatus) {
  const order = await tx.query("SELECT payment_provider, is_demo, status FROM orders WHERE id=$1 FOR UPDATE", [id]);
  if (!order.rows.length || order.rows[0].payment_provider !== "asaas" || order.rows[0].is_demo !== false) throw new AdminError(409, "SANDBOX_ASSOCIATION", "Associação Sandbox inválida.");
  const current = order.rows[0].status;
  if (current === "refunded" || (current === "paid" && status !== "refunded") || (status === "pending_payment") || (["expired", "canceled"].includes(current) && ["expired", "canceled"].includes(status))) return getOrderDetail(id, tx);
  return applyStatusTransition(tx, id, status, "Estado confirmado pelo Asaas Sandbox.", { actorType: "provider_webhook", actorId: "asaas-sandbox" }, { environment: "sandbox" }, true);
}

/** Releases stock reservation of an unsettled Asaas Sandbox attempt after provider verification. */
export async function cancelSandboxOrder(
  tx: PoolClient,
  id: string,
  adminId: string,
  reason?: string,
): Promise<OrderDetail> {
  const order = await tx.query(
    "SELECT payment_provider, is_demo, status FROM orders WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (!order.rows.length || order.rows[0].payment_provider !== "asaas" || order.rows[0].is_demo !== false) {
    throw new AdminError(409, "SANDBOX_ASSOCIATION", "Associação Sandbox inválida.");
  }
  const current = String(order.rows[0].status) as OrderStatus;
  if (["paid", "refunded"].includes(current)) {
    throw new AdminError(
      409,
      "CANNOT_CANCEL_SETTLED",
      "Pedido já liquidado ou estornado não pode ser cancelado manualmente.",
    );
  }
  if (["canceled", "expired"].includes(current)) {
    return getOrderDetail(id, tx);
  }
  return applyStatusTransition(
    tx,
    id,
    "canceled",
    reason?.trim() || "Tentativa Asaas Sandbox cancelada pelo administrador com liberação de estoque.",
    { actorType: "admin", actorId: adminId },
    { environment: "sandbox", trigger: "admin_sandbox_cancel" },
    true,
  );
}

export async function expireOverdueOrders(
  actor: { actorType: OrderActorType; actorId?: string | null } = {
    actorType: "system",
    actorId: "expiration-sweep",
  },
  db: Db = pool(),
): Promise<OrderDetail[]> {
  return withTransaction(db, async (tx) => {
    const overdueRes = await tx.query(
      `SELECT id
         FROM orders
        WHERE status = 'pending_payment'
          AND payment_provider = 'demo'
          AND expires_at IS NOT NULL
          AND expires_at <= now()
        ORDER BY id ASC
        FOR UPDATE SKIP LOCKED`,
    );
    const expired: OrderDetail[] = [];
    for (const row of overdueRes.rows) {
      const detail = await applyStatusTransition(
        tx,
        String(row.id),
        "expired",
        "Reserva expirada automaticamente após o prazo limite.",
        actor,
        { trigger: "expiration_sweep" },
      );
      expired.push(detail);
    }
    return expired;
  });
}

export function summarizeOrders(orders: readonly Order[]): AdminOrderSummary {
  orders = orders.filter(order => order.isDemo && order.paymentProvider === "demo");
  return {
    totalOrders: orders.length,
    pendingPaymentCount: orders.filter((o) => o.status === "pending_payment").length,
    paidCount: orders.filter((o) => o.status === "paid").length,
    canceledOrExpiredCount: orders.filter(
      (o) => o.status === "canceled" || o.status === "expired" || o.status === "refunded",
    ).length,
    demoVolumeCents: orders
      .filter((o) => o.status === "paid" || o.status === "pending_payment")
      .reduce((sum, o) => sum + o.totalCents, 0),
  };
}
