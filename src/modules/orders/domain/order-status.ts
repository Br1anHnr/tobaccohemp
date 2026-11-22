import type {
  OrderChannel,
  OrderPaymentMethod,
  OrderStatus,
  OrderStockStatus,
} from "@/shared/contracts/orders";
import { AdminError } from "@/shared/server/validation";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Rascunho",
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  expired: "Expirado",
  canceled: "Cancelado",
  refunded: "Estornado",
};

export const ORDER_STOCK_STATUS_LABEL: Record<OrderStockStatus, string> = {
  none: "Sem reserva de estoque",
  reserved: "Estoque reservado",
  committed: "Estoque baixado (confirmado)",
  released: "Estoque devolvido",
};

export const ORDER_CHANNEL_LABEL: Record<OrderChannel, string> = {
  site: "Checkout no site",
  whatsapp_link: "Link via WhatsApp",
};

export const ORDER_PAYMENT_METHOD_LABEL: Record<OrderPaymentMethod, string> = {
  pix: "Pix (demo)",
  card: "Cartão hospedado (demo)",
  demo: "Demonstração",
};

export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["pending_payment", "canceled"],
  pending_payment: ["paid", "expired", "canceled"],
  paid: ["refunded"],
  expired: [],
  canceled: [],
  refunded: [],
};

export function allowedNextStatuses(current: OrderStatus): readonly OrderStatus[] {
  return ALLOWED_ORDER_TRANSITIONS[current];
}

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_ORDER_TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) {
    throw new AdminError(409, "SAME_STATUS", "O pedido já se encontra neste status.");
  }
  if (!canTransitionOrderStatus(from, to)) {
    throw new AdminError(
      409,
      "INVALID_TRANSITION",
      `Transição de "${ORDER_STATUS_LABEL[from]}" para "${ORDER_STATUS_LABEL[to]}" não permitida.`,
    );
  }
}
