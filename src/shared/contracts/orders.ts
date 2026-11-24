/** Shared order domain & wire contracts. Monetary values use integer BRL cents; timestamps are ISO-8601 UTC. */

export const ORDER_STATUSES = [
  "draft",
  "pending_payment",
  "paid",
  "expired",
  "canceled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_CHANNELS = ["site", "whatsapp_link"] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export const ORDER_PAYMENT_METHODS = ["pix", "card", "demo"] as const;
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

export const PAYMENT_PROVIDER_IDS = ["demo", "pagbank", "asaas"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export type OrderEligibilityStatus = "eligible_demo" | "blocked";
export type OrderActorType = "system" | "admin" | "customer" | "provider_webhook";

export const ORDER_STOCK_STATUSES = [
  "none",
  "reserved",
  "committed",
  "released",
] as const;
export type OrderStockStatus = (typeof ORDER_STOCK_STATUSES)[number];

export interface StockMovement {
  productId: string;
  before: number;
  after: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  productName: string;
  categorySlug: string;
  variant: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  eligible: boolean;
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string;
  actorType: OrderActorType;
  actorId: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerAccountId: string | null;
  customerLabel: string;
  status: OrderStatus;
  channel: OrderChannel;
  paymentProvider: PaymentProviderId;
  paymentMethod: OrderPaymentMethod;
  providerReference: string | null;
  checkoutUrl: string | null;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  currency: "BRL";
  isDemo: boolean;
  eligibilityStatus: OrderEligibilityStatus;
  stockStatus?: OrderStockStatus;
  stockReservedAt?: string | null;
  stockReleasedAt?: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
  history: OrderStatusHistoryEntry[];
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  variant?: string;
}

export interface CreateOrderInput {
  customerAccountId?: string | null;
  customerLabel?: string;
  channel: OrderChannel;
  paymentMethod: OrderPaymentMethod;
  shippingCents?: number;
  discountCents?: number;
  idempotencyKey?: string;
  items: CreateOrderItemInput[];
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  reason?: string;
}

export interface AdminOrderSummary {
  totalOrders: number;
  pendingPaymentCount: number;
  paidCount: number;
  canceledOrExpiredCount: number;
  demoVolumeCents: number;
}
