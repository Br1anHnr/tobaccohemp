import {
  ORDER_CHANNELS,
  ORDER_PAYMENT_METHODS,
  ORDER_STATUSES,
  type CreateOrderInput,
  type CreateOrderItemInput,
  type OrderChannel,
  type OrderPaymentMethod,
  type OrderStatus,
  type UpdateOrderStatusInput,
} from "@/shared/contracts/orders";
import { AdminError, integerInput, invalid, objectInput, textInput } from "@/shared/server/validation";

function optionalObject(value: unknown, allowedKeys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !allowedKeys.includes(key))) invalid();
  return object;
}

function parseOrderItem(value: unknown): CreateOrderItemInput {
  const input = optionalObject(value, ["productId", "quantity", "variant"]);
  const productId = textInput(input.productId, 80);
  const quantity = integerInput(input.quantity);
  if (quantity < 1 || quantity > 99) {
    throw new AdminError(422, "VALIDATION", "A quantidade por item deve estar entre 1 e 99.");
  }
  const variant =
    input.variant === undefined || input.variant === ""
      ? undefined
      : textInput(input.variant, 60);
  return { productId, quantity, variant };
}

function parseIdempotencyKey(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const key = textInput(value, 128);
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) invalid();
  return key;
}

function mergeOrderItems(rawItems: CreateOrderItemInput[]): CreateOrderItemInput[] {
  const merged = new Map<string, CreateOrderItemInput>();
  for (const item of rawItems) {
    const key = `${item.productId}\u0000${item.variant ?? ""}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item });
      continue;
    }
    const nextQty = existing.quantity + item.quantity;
    if (nextQty > 99) {
      throw new AdminError(422, "VALIDATION", "A quantidade por item deve estar entre 1 e 99.");
    }
    existing.quantity = nextQty;
  }
  return Array.from(merged.values());
}

export function createOrderInput(value: unknown): CreateOrderInput {
  const input = optionalObject(value, [
    "customerAccountId",
    "customerLabel",
    "channel",
    "paymentMethod",
    "shippingCents",
    "discountCents",
    "idempotencyKey",
    "items",
  ]);

  if (typeof input.channel !== "string" || !ORDER_CHANNELS.includes(input.channel as OrderChannel)) {
    invalid();
  }
  if (
    typeof input.paymentMethod !== "string" ||
    !ORDER_PAYMENT_METHODS.includes(input.paymentMethod as OrderPaymentMethod)
  ) {
    invalid();
  }
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 50) {
    throw new AdminError(422, "VALIDATION", "Informe entre 1 e 50 itens para o pedido.");
  }

  const items = mergeOrderItems(input.items.map(parseOrderItem));
  const customerAccountId =
    input.customerAccountId === undefined || input.customerAccountId === null
      ? null
      : textInput(input.customerAccountId, 80);
  const customerLabel =
    input.customerLabel === undefined || input.customerLabel === ""
      ? "Pedido demonstrativo"
      : textInput(input.customerLabel, 120);
  const shippingCents = input.shippingCents === undefined ? 0 : integerInput(input.shippingCents);
  const discountCents = input.discountCents === undefined ? 0 : integerInput(input.discountCents);
  const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);

  return {
    customerAccountId,
    customerLabel,
    channel: input.channel as OrderChannel,
    paymentMethod: input.paymentMethod as OrderPaymentMethod,
    shippingCents,
    discountCents,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    items,
  };
}

export function updateOrderStatusInput(value: unknown): UpdateOrderStatusInput {
  const input = objectInput(value, ["status", "reason"], true);
  if (typeof input.status !== "string" || !ORDER_STATUSES.includes(input.status as OrderStatus)) {
    invalid();
  }
  const reason =
    input.reason === undefined || input.reason === ""
      ? undefined
      : textInput(input.reason, 240);
  return {
    status: input.status as OrderStatus,
    reason,
  };
}
