import { randomUUID } from "node:crypto";
import { findProduct } from "@/data/products";
import { listProducts } from "@/modules/catalog";
import { listInventory } from "@/modules/inventory";
import type {
  AdminOrderSummary,
  Order,
  OrderActorType,
  OrderChannel,
  OrderDetail,
  OrderEligibilityStatus,
  OrderItem,
  OrderPaymentMethod,
  OrderStatus,
  OrderStatusHistoryEntry,
  PaymentProviderId,
} from "@/shared/contracts/orders";
import { pool, type Db } from "@/shared/server/database";
import { AdminError, missing } from "@/shared/server/validation";
import {
  calculateLineTotalCents,
  calculateOrderTotals,
  generateOrderNumber,
} from "../domain/calculations";
import { evaluateOrderEligibility } from "../domain/eligibility";
import { createOrderInput, updateOrderStatusInput } from "../domain/order-input";
import { assertOrderTransition, ORDER_STATUS_LABEL } from "../domain/order-status";
import { getPaymentProvider } from "../domain/payment-provider";

const DEMO_EXPIRATION_MS = 30 * 60 * 1000;

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapOrderRow(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    customerAccountId: row.customer_account_id === null ? null : String(row.customer_account_id),
    customerLabel: String(row.customer_label),
    status: String(row.status) as OrderStatus,
    channel: String(row.channel) as OrderChannel,
    paymentProvider: String(row.payment_provider) as PaymentProviderId,
    paymentMethod: String(row.payment_method) as OrderPaymentMethod,
    providerReference: row.provider_reference === null ? null : String(row.provider_reference),
    checkoutUrl: row.checkout_url === null ? null : String(row.checkout_url),
    subtotalCents: Number(row.subtotal_cents),
    shippingCents: Number(row.shipping_cents),
    discountCents: Number(row.discount_cents),
    totalCents: Number(row.total_cents),
    currency: "BRL",
    isDemo: row.is_demo === true,
    eligibilityStatus: String(row.eligibility_status) as OrderEligibilityStatus,
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
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    fromStatus: row.from_status === null ? null : (String(row.from_status) as OrderStatus),
    toStatus: String(row.to_status) as OrderStatus,
    reason: String(row.reason),
    actorType: String(row.actor_type) as OrderActorType,
    actorId: row.actor_id === null ? null : String(row.actor_id),
    createdAt: toIso(row.created_at),
  };
}

export async function listOrders(db: Db = pool()): Promise<Order[]> {
  const result = await db.query(
    `SELECT id, order_number, customer_account_id, customer_label, status, channel,
            payment_provider, payment_method, provider_reference, checkout_url,
            subtotal_cents, shipping_cents, discount_cents, total_cents, currency,
            is_demo, eligibility_status, expires_at, created_at, updated_at
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
            is_demo, eligibility_status, expires_at, created_at, updated_at
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
      `SELECT id, order_id, from_status, to_status, reason, actor_type, actor_id, created_at
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

export async function createOrder(
  value: unknown,
  actor: { actorType: OrderActorType; actorId?: string | null },
  db: Db = pool(),
): Promise<OrderDetail> {
  const input = createOrderInput(value);
  const [products, inventory] = await Promise.all([listProducts(db), listInventory(db)]);

  const resolvedEntries = input.items.map((item) => {
    const dbProduct = products.find((p) => p.id === item.productId);
    const inv = inventory.find((i) => i.productId === item.productId);
    const staticMeta = findProduct(item.productId);
    const subject = dbProduct
      ? {
          id: dbProduct.id,
          name: dbProduct.name,
          sku: dbProduct.sku,
          categorySlug: staticMeta?.categorySlug ?? "acessorios",
          active: dbProduct.active,
          stock: inv?.quantity ?? 0,
          tags: staticMeta?.tags ?? [],
        }
      : undefined;
    return {
      requested: item,
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

  const frozenItems = resolvedEntries.map((entry) => {
    const product = entry.dbProduct!;
    const unitPriceCents = product.priceCents;
    const quantity = entry.requested.quantity;
    return {
      id: randomUUID(),
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      categorySlug: entry.subject?.categorySlug ?? "acessorios",
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

  const now = new Date();
  const createdAt = now.toISOString();
  const intentAt = new Date(now.getTime() + 1).toISOString();
  const expiresAt = new Date(now.getTime() + DEMO_EXPIRATION_MS).toISOString();
  const orderId = randomUUID();
  const orderNumber = generateOrderNumber();

  const provider = getPaymentProvider("demo");
  const intent = provider.createPaymentIntent({
    orderNumber,
    amountCents: totals.totalCents,
    currency: "BRL",
    channel: input.channel,
    method: input.paymentMethod,
    isDemo: true,
    expiresAt,
  });

  await db.query(
    `INSERT INTO orders (
       id, order_number, customer_account_id, customer_label, status, channel,
       payment_provider, payment_method, provider_reference, checkout_url,
       subtotal_cents, shipping_cents, discount_cents, total_cents, currency,
       is_demo, eligibility_status, expires_at, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10,
       $11, $12, $13, $14, 'BRL',
       $15, $16, $17, $18, $19
     )`,
    [
      orderId,
      orderNumber,
      input.customerAccountId ?? null,
      input.customerLabel ?? "Pedido demonstrativo",
      intent.status,
      input.channel,
      intent.provider,
      input.paymentMethod,
      intent.providerReference,
      intent.checkoutUrl,
      totals.subtotalCents,
      totals.shippingCents,
      totals.discountCents,
      totals.totalCents,
      true,
      eligibility.eligibilityStatus,
      expiresAt,
      createdAt,
      intentAt,
    ],
  );

  for (const item of frozenItems) {
    await db.query(
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

  await db.query(
    `INSERT INTO order_status_history (
       id, order_id, from_status, to_status, reason, actor_type, actor_id, metadata_json, created_at
     ) VALUES ($1, $2, NULL, 'draft', $3, $4, $5, '{}', $6),
              ($7, $2, 'draft', $8, $9, 'system', $10, '{}', $11)`,
    [
      randomUUID(),
      orderId,
      "Pedido demonstrativo criado com preços congelados.",
      actor.actorType,
      actor.actorId ?? null,
      createdAt,
      randomUUID(),
      intent.status,
      intent.notice,
      intent.provider,
      intentAt,
    ],
  );

  return getOrderDetail(orderId, db);
}

export async function transitionOrderStatus(
  id: string,
  value: unknown,
  actor: { actorType: OrderActorType; actorId?: string | null },
  db: Db = pool(),
): Promise<OrderDetail> {
  const input = updateOrderStatusInput(value);
  const currentRes = await db.query(
    "SELECT status FROM orders WHERE id = $1 FOR UPDATE",
    [id],
  );
  if (!currentRes.rows.length) missing();

  const fromStatus = String(currentRes.rows[0].status) as OrderStatus;
  assertOrderTransition(fromStatus, input.status);

  const now = new Date().toISOString();
  const reason =
    input.reason ??
    `Status atualizado de "${ORDER_STATUS_LABEL[fromStatus]}" para "${ORDER_STATUS_LABEL[input.status]}".`;

  await db.query(
    "UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3",
    [input.status, now, id],
  );

  await db.query(
    `INSERT INTO order_status_history (
       id, order_id, from_status, to_status, reason, actor_type, actor_id, metadata_json, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, '{}', $8)`,
    [
      randomUUID(),
      id,
      fromStatus,
      input.status,
      reason,
      actor.actorType,
      actor.actorId ?? null,
      now,
    ],
  );

  return getOrderDetail(id, db);
}

export function summarizeOrders(orders: readonly Order[]): AdminOrderSummary {
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
