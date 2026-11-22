import { test, expect } from "@playwright/test";
import {
  allowedNextStatuses,
  assertOrderTransition,
  canTransitionOrderStatus,
} from "../src/modules/orders/domain/order-status";
import {
  evaluateItemEligibility,
  evaluateOrderEligibility,
  ONLINE_COMMERCE_POLICY,
} from "../src/modules/orders/domain/eligibility";
import {
  calculateLineTotalCents,
  calculateOrderTotals,
  generateOrderNumber,
} from "../src/modules/orders/domain/calculations";
import {
  demoPaymentProvider,
  getPaymentProvider,
} from "../src/modules/orders/domain/payment-provider";
import {
  createOrderInput,
  updateOrderStatusInput,
} from "../src/modules/orders/domain/order-input";

test("order status transitions enforce allowed state machine", () => {
  expect(canTransitionOrderStatus("draft", "pending_payment")).toBe(true);
  expect(canTransitionOrderStatus("draft", "canceled")).toBe(true);
  expect(canTransitionOrderStatus("draft", "paid")).toBe(false);
  expect(canTransitionOrderStatus("pending_payment", "paid")).toBe(true);
  expect(canTransitionOrderStatus("pending_payment", "expired")).toBe(true);
  expect(canTransitionOrderStatus("pending_payment", "canceled")).toBe(true);
  expect(canTransitionOrderStatus("paid", "refunded")).toBe(true);
  expect(allowedNextStatuses("canceled")).toEqual([]);
  expect(allowedNextStatuses("expired")).toEqual([]);
  expect(allowedNextStatuses("refunded")).toEqual([]);

  expect(() => assertOrderTransition("pending_payment", "paid")).not.toThrow();
  expect(() => assertOrderTransition("paid", "paid")).toThrow(/já se encontra/);
  expect(() => assertOrderTransition("canceled", "paid")).toThrow(/não permitida/);
});

test("eligibility blocks non-eligible or regulated items and keeps real payments disabled", () => {
  expect(ONLINE_COMMERCE_POLICY.realPaymentsEnabled).toBe(false);
  expect(ONLINE_COMMERCE_POLICY.mode).toBe("demonstrative");

  const validAccessory = {
    id: "case-01",
    name: "Case Compact Preto",
    sku: "CASE-COMPACT-PRETO",
    categorySlug: "cases",
    active: true,
    stock: 5,
    tags: ["estojo", "viagem"],
  };

  expect(evaluateItemEligibility(validAccessory, 2)).toEqual({
    eligibleForDemo: true,
    eligibleForRealCharge: false,
  });

  expect(
    evaluateItemEligibility({ ...validAccessory, active: false }, 1).eligibleForDemo,
  ).toBe(false);
  expect(
    evaluateItemEligibility({ ...validAccessory, archived: true }, 1).eligibleForDemo,
  ).toBe(false);
  expect(
    evaluateItemEligibility({ ...validAccessory, categorySlug: null }, 1)
      .eligibleForDemo,
  ).toBe(false);
  expect(
    evaluateItemEligibility({ ...validAccessory, stock: 1 }, 2).eligibleForDemo,
  ).toBe(false);
  expect(
    evaluateItemEligibility({ ...validAccessory, categorySlug: "tabaco" }, 1)
      .eligibleForDemo,
  ).toBe(false);
  expect(
    evaluateItemEligibility({ ...validAccessory, name: "Pod Eletrônico X" }, 1)
      .eligibleForDemo,
  ).toBe(false);
  expect(
    evaluateItemEligibility(
      { ...validAccessory, tags: ["nicotina"] },
      1,
    ).eligibleForDemo,
  ).toBe(false);

  const summary = evaluateOrderEligibility([
    { product: validAccessory, quantity: 1 },
    { product: { ...validAccessory, name: "Cigarro de Tabaco" }, quantity: 1 },
  ]);
  expect(summary.allowed).toBe(false);
  expect(summary.eligibilityStatus).toBe("blocked");
  expect(summary.blockedReasons.length).toBe(1);

  const multiVariantOverStock = evaluateOrderEligibility([
    { product: validAccessory, quantity: 3 },
    { product: validAccessory, quantity: 3 },
  ]);
  expect(multiVariantOverStock.allowed).toBe(false);
  expect(multiVariantOverStock.blockedReasons[0]).toContain("excede o estoque disponível");
});

test("order calculations use integer BRL cents and validate invariants", () => {
  expect(calculateLineTotalCents(4990, 2)).toBe(9980);
  expect(
    calculateOrderTotals(
      [
        { unitPriceCents: 4990, quantity: 2 },
        { unitPriceCents: 3990, quantity: 1 },
      ],
      1500,
      500,
    ),
  ).toEqual({
    subtotalCents: 13970,
    shippingCents: 1500,
    discountCents: 500,
    totalCents: 14970,
  });

  expect(() =>
    calculateOrderTotals([{ unitPriceCents: 1000, quantity: 1 }], 0, 2000),
  ).toThrow(/desconto/i);
  expect(generateOrderNumber()).toMatch(/^TH-[A-F0-9]{8}$/);
});

test("payment provider is decoupled and blocks real gateway charges", () => {
  const provider = getPaymentProvider("demo");
  expect(provider.isSandboxOnly).toBe(true);

  const pixIntent = demoPaymentProvider.createPaymentIntent({
    orderNumber: "TH-1234ABCD",
    amountCents: 4990,
    currency: "BRL",
    channel: "site",
    method: "pix",
    isDemo: true,
    expiresAt: "2026-12-01T00:00:00.000Z",
  });
  expect(pixIntent.provider).toBe("demo");
  expect(pixIntent.isDemo).toBe(true);
  expect(pixIntent.status).toBe("pending_payment");
  expect(pixIntent.pixCopyPaste).toContain("SEM-VALOR-FINANCEIRO");

  const cardIntent = demoPaymentProvider.createPaymentIntent({
    orderNumber: "TH-1234ABCD",
    amountCents: 4990,
    currency: "BRL",
    channel: "site",
    method: "card",
    isDemo: true,
    expiresAt: "2026-12-01T00:00:00.000Z",
  });
  expect(cardIntent.pixCopyPaste).toBeUndefined();
  expect(cardIntent.checkoutUrl).toBeNull();

  expect(() =>
    demoPaymentProvider.createPaymentIntent({
      orderNumber: "TH-1234ABCD",
      amountCents: 4990,
      currency: "BRL",
      channel: "site",
      method: "pix",
      isDemo: false,
      expiresAt: "2026-12-01T00:00:00.000Z",
    }),
  ).toThrow(/Cobranças reais não estão habilitadas/);

  expect(() => getPaymentProvider("pagbank")).toThrow(/não está homologado/);
  expect(() => getPaymentProvider("asaas")).toThrow(/não está homologado/);
});

test("order input parsers validate payloads strictly", () => {
  const parsed = createOrderInput({
    channel: "site",
    paymentMethod: "pix",
    customerLabel: "Teste Sandbox",
    idempotencyKey: "req-123_abc:1",
    items: [
      { productId: "case-01", quantity: 2, variant: "Preto" },
      { productId: "case-01", quantity: 1, variant: "Preto" },
    ],
  });
  expect(parsed.items).toHaveLength(1);
  expect(parsed.items[0].quantity).toBe(3);
  expect(parsed.idempotencyKey).toBe("req-123_abc:1");
  expect(parsed.shippingCents).toBe(0);

  expect(() =>
    createOrderInput({
      channel: "site",
      paymentMethod: "pix",
      idempotencyKey: "invalid key with spaces!",
      items: [{ productId: "case-01", quantity: 1 }],
    }),
  ).toThrow();
  expect(() =>
    createOrderInput({
      channel: "site",
      paymentMethod: "pix",
      items: [
        { productId: "case-01", quantity: 60, variant: "Preto" },
        { productId: "case-01", quantity: 50, variant: "Preto" },
      ],
    }),
  ).toThrow();
  expect(() =>
    createOrderInput({ channel: "site", paymentMethod: "pix", items: [] }),
  ).toThrow();
  expect(() =>
    createOrderInput({
      channel: "invalid",
      paymentMethod: "pix",
      items: [{ productId: "case-01", quantity: 1 }],
    }),
  ).toThrow();

  expect(updateOrderStatusInput({ status: "paid", reason: "Sandbox OK" })).toEqual({
    status: "paid",
    reason: "Sandbox OK",
  });
  expect(() => updateOrderStatusInput({ status: "unknown" })).toThrow();
});
