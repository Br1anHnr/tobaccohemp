import { AdminError } from "@/shared/server/validation";

export interface PricedLine {
  unitPriceCents: number;
  quantity: number;
}

export interface OrderTotals {
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
}

export function calculateLineTotalCents(unitPriceCents: number, quantity: number): number {
  if (
    !Number.isSafeInteger(unitPriceCents) ||
    unitPriceCents < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    throw new AdminError(422, "VALIDATION", "Valores ou quantidades de item inválidos.");
  }
  const lineTotal = unitPriceCents * quantity;
  if (!Number.isSafeInteger(lineTotal)) {
    throw new AdminError(422, "VALIDATION", "Subtotal de item excede o limite permitido.");
  }
  return lineTotal;
}

export function calculateOrderTotals(
  items: readonly PricedLine[],
  shippingCents = 0,
  discountCents = 0,
): OrderTotals {
  if (!Number.isSafeInteger(shippingCents) || shippingCents < 0) {
    throw new AdminError(422, "VALIDATION", "Valor de entrega inválido.");
  }
  if (!Number.isSafeInteger(discountCents) || discountCents < 0) {
    throw new AdminError(422, "VALIDATION", "Valor de desconto inválido.");
  }
  const subtotalCents = items.reduce(
    (sum, item) => sum + calculateLineTotalCents(item.unitPriceCents, item.quantity),
    0,
  );
  const gross = subtotalCents + shippingCents;
  if (!Number.isSafeInteger(subtotalCents) || !Number.isSafeInteger(gross)) {
    throw new AdminError(422, "VALIDATION", "Total do pedido excede o limite permitido.");
  }
  if (discountCents > gross) {
    throw new AdminError(422, "VALIDATION", "O desconto não pode superar o valor do pedido.");
  }
  return {
    subtotalCents,
    shippingCents,
    discountCents,
    totalCents: gross - discountCents,
  };
}

export function generateOrderNumber(): string {
  return `TH-${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
