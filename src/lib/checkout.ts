import { findProduct } from "@/data/products";
import {
  calculateLineTotalCents,
  calculateOrderTotals,
  generateOrderNumber,
} from "@/modules/orders/domain/calculations";
import {
  evaluateOrderEligibility,
  ONLINE_COMMERCE_POLICY,
  type OrderEligibilitySummary,
} from "@/modules/orders/domain/eligibility";
import { getPaymentProvider } from "@/modules/orders/domain/payment-provider";
import type { OrderChannel, OrderPaymentMethod } from "@/shared/contracts/orders";
import { cartCount, cartTotal } from "@/store/cart-store";
import type { CartItem, DemoOrder, DemoOrderItemSnapshot } from "@/types/cart";

export const checkoutFields = [
  { name: "name", label: "Nome completo", autoComplete: "name" },
  { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
  { name: "phone", label: "Telefone", type: "tel", autoComplete: "tel" },
  { name: "zip", label: "CEP", autoComplete: "postal-code" },
  { name: "address", label: "Endereço", autoComplete: "address-line1" },
  { name: "number", label: "Número", autoComplete: "off" },
  {
    name: "complement",
    label: "Complemento (opcional)",
    autoComplete: "address-line2",
    optional: true,
  },
  { name: "city", label: "Cidade", autoComplete: "address-level2" },
] as const;

export function validateCheckout(data: FormData) {
  const errors: Record<string, string> = {};
  for (const field of checkoutFields)
    if (!("optional" in field) && !String(data.get(field.name) ?? "").trim())
      errors[field.name] = `Preencha ${field.label.toLowerCase()}.`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.get("email"))))
    errors.email = "Informe um e-mail válido.";
  const phone = String(data.get("phone")).replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 11)
    errors.phone = "Informe um telefone com DDD (10 ou 11 dígitos).";
  if (String(data.get("zip")).replace(/\D/g, "").length !== 8)
    errors.zip = "Informe um CEP com 8 dígitos.";
  if (!/^[A-Z]{2}$/.test(String(data.get("state"))))
    errors.state = "Selecione o estado.";
  if (data.get("demo") !== "on")
    errors.demo = "Confirme que este é um pedido demonstrativo.";
  return errors;
}

export function evaluateCartEligibility(items: CartItem[]): OrderEligibilitySummary {
  return evaluateOrderEligibility(
    items.map((item) => {
      const product = findProduct(item.productId);
      return {
        product: product
          ? {
              id: product.id,
              name: product.name,
              sku: (product.slug ?? product.id).toUpperCase(),
              categorySlug: product.categorySlug,
              active: true,
              stock: product.stock,
              tags: product.tags,
            }
          : undefined,
        quantity: item.quantity,
      };
    }),
  );
}

// Replace this adapter with a server-side order service when real commerce is connected.
// Personal form data is intentionally never stored by this local demonstration.
export function createDemoOrder(
  items: CartItem[],
  options: { channel?: OrderChannel; paymentMethod?: OrderPaymentMethod } = {},
): DemoOrder {
  const eligibility = evaluateCartEligibility(items);
  if (!eligibility.allowed) {
    throw new Error(eligibility.blockedReasons[0] ?? "Itens não elegíveis para pedido.");
  }

  const channel: OrderChannel =
    options.channel === "whatsapp_link" ? "whatsapp_link" : "site";
  const paymentMethod: OrderPaymentMethod =
    options.paymentMethod === "card" || options.paymentMethod === "demo"
      ? options.paymentMethod
      : "pix";

  const snapshots: DemoOrderItemSnapshot[] = items.map((item) => {
    const product = findProduct(item.productId)!;
    const unitPriceCents = Math.round(product.price * 100);
    return {
      productId: product.id,
      sku: (product.slug ?? product.id).toUpperCase(),
      name: product.name,
      variant: item.variant,
      quantity: item.quantity,
      unitPriceCents,
      lineTotalCents: calculateLineTotalCents(unitPriceCents, item.quantity),
    };
  });

  const totals = calculateOrderTotals(snapshots, 0, 0);
  const number = generateOrderNumber();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const provider = getPaymentProvider("demo");
  const intent = provider.createPaymentIntent({
    orderNumber: number,
    amountCents: totals.totalCents,
    currency: "BRL",
    channel,
    method: paymentMethod,
    isDemo: true,
    expiresAt,
  });

  return {
    number,
    total: cartTotal(items),
    count: cartCount(items),
    createdAt,
    status: intent.status,
    channel,
    paymentMethod,
    provider: intent.provider,
    providerReference: intent.providerReference,
    pixCopyPaste: intent.pixCopyPaste,
    providerNotice: `${intent.notice} ${ONLINE_COMMERCE_POLICY.notice}`,
    expiresAt,
    subtotalCents: totals.subtotalCents,
    shippingCents: totals.shippingCents,
    discountCents: totals.discountCents,
    totalCents: totals.totalCents,
    items: snapshots,
    history: [
      {
        fromStatus: null,
        toStatus: "draft",
        reason: "Pedido demonstrativo montado com preços congelados.",
        createdAt,
      },
      {
        fromStatus: "draft",
        toStatus: intent.status,
        reason: intent.notice,
        createdAt: new Date(Date.now() + 1).toISOString(),
      },
    ],
  };
}
