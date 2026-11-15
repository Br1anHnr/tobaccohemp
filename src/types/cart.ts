import type {
  OrderChannel,
  OrderPaymentMethod,
  OrderStatus,
  PaymentProviderId,
} from "@/shared/contracts/orders";

export interface CartItem {
  productId: string;
  quantity: number;
  variant?: string;
}

export interface DemoOrderItemSnapshot {
  productId: string;
  sku: string;
  name: string;
  variant?: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface DemoOrderHistoryEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string;
  createdAt: string;
}

export interface DemoOrder {
  number: string;
  total: number;
  count: number;
  createdAt: string;
  status?: OrderStatus;
  channel?: OrderChannel;
  paymentMethod?: OrderPaymentMethod;
  provider?: PaymentProviderId;
  providerReference?: string;
  pixCopyPaste?: string;
  providerNotice?: string;
  expiresAt?: string;
  subtotalCents?: number;
  shippingCents?: number;
  discountCents?: number;
  totalCents?: number;
  items?: DemoOrderItemSnapshot[];
  history?: DemoOrderHistoryEntry[];
}
