import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { ASAAS_SANDBOX } from "@/lib/constants";
import type { OrderStatus } from "@/shared/contracts/orders";
import { sandboxPool, type Db } from "@/shared/server/database";
import { AdminError } from "@/shared/server/validation";
import { createOrderInput } from "../domain/order-input";
import { cancelSandboxOrder, createOrder, getOrderDetail, reconcileSandboxOrder } from "./orders";
import { AsaasClient, AsaasProviderError, checkoutUrl, resourceId, sandboxConfig } from "./asaas-client";

export const ASAAS_EVENTS = ["PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_RESTORED", "PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_REFUND_DENIED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL", "CHECKOUT_CREATED", "CHECKOUT_PAID", "CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"] as const;
type Attempt = {
  order_id: string;
  external_reference: string;
  method: "pix" | "card";
  state: string;
  provider_id: string | null;
  payment_id: string | null;
  updated_at: Date;
  last_provider_status?: string | null;
  last_error_code?: string | null;
  last_error_status?: number | null;
  last_error_at?: string | null;
};

export interface SandboxDiagnostic {
  code: string;
  httpStatus: number | null;
}

async function transaction<T>(fn: (tx: PoolClient) => Promise<T>) {
  const tx = await sandboxPool().connect();
  try { await tx.query("BEGIN"); const value = await fn(tx); await tx.query("COMMIT"); return value; }
  catch (error) { await tx.query("ROLLBACK"); throw error; }
  finally { tx.release(); }
}

/** Inserts a synthetic non-PII actor reference in the isolated Sandbox DB so order FKs succeed without copying production PII. */
async function ensureSandboxShadowAccount(tx: PoolClient, accountId: string) {
  const digest = createHash("sha256").update(accountId).digest("hex").slice(0, 24);
  await tx.query(
    `INSERT INTO customer_accounts (id, name, email, password_hash, phone, city, state, created_at, updated_at)
     VALUES ($1, 'Admin Sandbox Teste', $2, 'sandbox-shadow-disabled', '11999990000', '', '', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [accountId, `sandbox-${digest}@sandbox.local`],
  );
}

async function attempt(tx: PoolClient, id: string): Promise<Attempt> {
  const result = await tx.query("SELECT * FROM asaas_sandbox_attempts WHERE order_id=$1 FOR UPDATE", [id]);
  if (!result.rows.length) throw new AdminError(404, "NOT_FOUND", "Pedido Sandbox não encontrado.");
  return result.rows[0] as Attempt;
}

function diagnosticFromError(error: unknown, fallbackCode: string): SandboxDiagnostic {
  if (error instanceof AsaasProviderError) {
    return { code: error.providerCode, httpStatus: error.httpStatus };
  }
  if (error instanceof AdminError) {
    return { code: error.code, httpStatus: error.status };
  }
  return { code: fallbackCode, httpStatus: null };
}

async function recordAttemptDiagnostic(
  db: Db | PoolClient,
  orderId: string,
  diagnostic: SandboxDiagnostic,
) {
  await db.query(
    "UPDATE asaas_sandbox_attempts SET last_error_code=$2,last_error_status=$3,last_error_at=now(),updated_at=now() WHERE order_id=$1",
    [orderId, diagnostic.code, diagnostic.httpStatus],
  );
}

export async function createSandboxPayment(
  value: unknown,
  accountId: string,
  origin: string,
  client = new AsaasClient(),
  options: { callbackPath?: string; requireAdminMode?: boolean } = {},
) {
  const config = sandboxConfig(options.requireAdminMode ? "admin" : "any");
  // Only cart lines, method and idempotency key come from the browser.
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdminError(422, "VALIDATION", "Pedido inválido.");
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(k => !["items", "paymentMethod", "idempotencyKey"].includes(k))) throw new AdminError(422, "VALIDATION", "Campos inválidos.");
  const input = createOrderInput({ ...raw, channel: "site", customerAccountId: accountId, customerLabel: "Teste Asaas Sandbox" });
  if (!input.idempotencyKey || !["pix", "card"].includes(input.paymentMethod) || input.items.some(i => !config.productIds.has(i.productId))) throw new AdminError(422, "SANDBOX_CATALOG", "Use apenas acessórios sintéticos configurados e uma chave de idempotência.");
  if (input.paymentMethod === "pix" && !/^cus_[A-Za-z0-9]+$/.test(config.customer)) throw new AdminError(503, "SANDBOX_CUSTOMER", "Configure o cliente sintético Sandbox para Pix.");
  input.idempotencyKey = `asaas:${createHash("sha256").update(`${accountId}:${input.idempotencyKey}`).digest("hex")}`;
  const orderId = await transaction(async tx => {
    await ensureSandboxShadowAccount(tx, accountId);
    // Core freezes server prices, checks accessory eligibility and reserves inventory.
    const order = await createOrder(input, { actorType: "customer", actorId: accountId }, tx, true);
    if (order.paymentProvider !== "asaas" || order.isDemo) throw new AdminError(409, "SANDBOX_ASSOCIATION", "Pedido incompatível.");
    await tx.query("INSERT INTO asaas_sandbox_attempts(order_id,external_reference,method,state) VALUES($1,$2,$3,'prepared') ON CONFLICT(order_id) DO NOTHING", [order.id, `th-sbx-${order.id}`, input.paymentMethod]);
    return order.id;
  });
  // This commit is BEFORE the provider POST. A crash/timeout never resets creating.
  const send = await transaction(async tx => {
    const a = await attempt(tx, orderId);
    if (a.state !== "prepared") return false;
    await tx.query("UPDATE asaas_sandbox_attempts SET state='creating',updated_at=now() WHERE order_id=$1", [orderId]);
    return true;
  });
  if (send) {
    try {
      const order = await getOrderDetail(orderId, sandboxPool());
      const reference = `th-sbx-${order.id}`;
      const callbackPath =
        options.callbackPath && options.callbackPath.startsWith("/")
          ? options.callbackPath
          : "/checkout";
      const callback = `${origin}${callbackPath}?asaasOrder=${encodeURIComponent(order.id)}`;
      const response = input.paymentMethod === "pix"
        ? await client.request("/payments", { customer: config.customer, billingType: "PIX", value: order.totalCents / 100, dueDate: new Date().toISOString().slice(0,10), externalReference: reference, description: "Acessórios sintéticos — teste Sandbox" })
        : await client.request("/checkouts", { billingTypes: ["CREDIT_CARD"], chargeTypes: ["DETACHED"], minutesToExpire: ASAAS_SANDBOX.checkoutMinutes, externalReference: reference,
          callback: { successUrl: callback, cancelUrl: callback, expiredUrl: callback },
          items: order.items.map(i => ({ name: i.productName, quantity: i.quantity, value: i.unitPriceCents / 100 })) });
      const id = resourceId(response.id);
      await transaction(async tx => {
        const existing = await attempt(tx, orderId);
        if (existing.provider_id && existing.provider_id !== id) throw new AdminError(409,"ASAAS_DIVERGENCE","Associação divergente.");
        await tx.query("UPDATE asaas_sandbox_attempts SET provider_id=$2,payment_id=$3,state='ready',last_error_code=NULL,last_error_status=NULL,last_error_at=NULL,updated_at=now() WHERE order_id=$1", [orderId,id,input.paymentMethod === "pix" ? id : null]);
        await tx.query("UPDATE orders SET provider_reference=$2,checkout_url=$3,updated_at=now() WHERE id=$1 AND payment_provider='asaas' AND is_demo=false", [orderId,id,input.paymentMethod === "card" ? checkoutUrl(id) : null]);
      });
    } catch (error) {
      const diag = diagnosticFromError(error, "PROVIDER_CREATE_FAILED");
      await sandboxPool().query(
        "UPDATE asaas_sandbox_attempts SET state='uncertain',last_error_code=$2,last_error_status=$3,last_error_at=now(),updated_at=now() WHERE order_id=$1 AND state='creating'",
        [orderId, diag.code, diag.httpStatus],
      );
      // Return the durable order handle so the user can reconcile this exact attempt.
    }
  }
  return sandboxPaymentView(orderId, accountId, client, { requireAdminMode: options.requireAdminMode });
}

function dataList(value: Record<string, unknown>) {
  if (!Array.isArray(value.data) || value.hasMore === true) throw new AdminError(502,"ASAAS_RESPONSE","Resposta de conciliação incompleta.");
  return value.data as Record<string, unknown>[];
}

function verifiedPayment(payment: Record<string, unknown>, a: Attempt, total: number) {
  const cents = Number(payment.value) * 100;
  // Checkout payments can expose only checkoutSession. That provider-queried
  // reference must match the session already associated at creation/webhook.
  const referenceMatches = payment.externalReference === a.external_reference ||
    (a.method === "card" && !!a.provider_id && payment.checkoutSession === a.provider_id && (payment.externalReference == null || payment.externalReference === ""));
  if (!referenceMatches || typeof payment.value !== "number" || !Number.isFinite(cents) || Math.abs(cents - total) > 0.00001 ||
      (payment.currency !== undefined && payment.currency !== "BRL") ||
      payment.billingType !== (a.method === "pix" ? "PIX" : "CREDIT_CARD") ||
      (a.method === "pix" && (payment.customer !== sandboxConfig().customer || (a.provider_id && payment.id !== a.provider_id))) ||
      (a.method === "card" && a.provider_id && payment.checkoutSession !== a.provider_id)) {
    throw new AdminError(409, "ASAAS_DIVERGENCE", "Dados do provedor divergentes; revisão necessária.");
  }
  resourceId(payment.id);
  if (a.method === "card") resourceId(payment.checkoutSession);
}

function statusFor(payment: Record<string, unknown>): OrderStatus | null {
  if (payment.status === "REFUNDED") return "refunded";
  // Refund/chargeback/pending states never count as settled revenue.
  if (["RECEIVED", "CONFIRMED"].includes(String(payment.status))) {
    if ((Array.isArray(payment.refunds) && payment.refunds.length) || payment.chargeback) return null;
    return "paid";
  }
  if (payment.deleted === true) return "canceled";
  if (payment.status === "OVERDUE") return "expired";
  return null;
}

async function reconcile(
  tx: PoolClient,
  a: Attempt,
  client: AsaasClient,
  candidatePayment?: string,
  recoverExpiredCheckout = false,
) {
  const order = await getOrderDetail(a.order_id, tx);
  let payment: Record<string, unknown> | undefined;
  if (a.payment_id || candidatePayment) {
    payment = await client.request(`/payments/${resourceId(a.payment_id ?? candidatePayment)}`);
  } else {
    const query = new URLSearchParams({ limit: "100" });
    if (a.method === "card" && a.provider_id) query.set("checkoutSession", a.provider_id);
    else query.set("externalReference", a.external_reference);
    const list = dataList(await client.request(`/payments?${query}`));
    if (list.length > 1) throw new AdminError(409,"ASAAS_MULTIPLE_PAYMENTS","Múltiplas cobranças exigem revisão.");
    if (list.length) payment = await client.request(`/payments/${resourceId(list[0].id)}`);
  }
  if (!payment) {
    // Asaas does not expose a GET for checkout sessions. Wait beyond the configured
    // provider lifetime before releasing a known card session without a payment.
    if (recoverExpiredCheckout && a.method === "card" && a.provider_id && order.status === "pending_payment" &&
        Date.now() >= a.updated_at.getTime() + (ASAAS_SANDBOX.checkoutMinutes + 2) * 60_000) {
      await reconcileSandboxOrder(tx, a.order_id, "expired");
    }
    return;
  }
  verifiedPayment(payment, a, order.totalCents);
  const providerId = a.method === "pix" ? resourceId(payment.id) : resourceId(payment.checkoutSession);
  await tx.query("UPDATE asaas_sandbox_attempts SET provider_id=$2,payment_id=$3,state='ready',last_provider_status=$4,last_error_code=NULL,last_error_status=NULL,last_error_at=NULL,updated_at=now() WHERE order_id=$1", [a.order_id,providerId,payment.id,String(payment.status)]);
  await tx.query("UPDATE orders SET provider_reference=$2,checkout_url=$3 WHERE id=$1 AND payment_provider='asaas' AND is_demo=false", [a.order_id,providerId,a.method === "card" ? checkoutUrl(providerId) : null]);
  const status = statusFor(payment);
  if (status) await reconcileSandboxOrder(tx,a.order_id,status);
  else if (!["PENDING","AWAITING_RISK_ANALYSIS"].includes(String(payment.status)) || (Array.isArray(payment.refunds) && payment.refunds.length) || payment.chargeback) {
    await tx.query("UPDATE asaas_sandbox_attempts SET state='review' WHERE order_id=$1", [a.order_id]);
  }
}

export async function adminReconcileSandbox(id: string, client = new AsaasClient()) {
  sandboxConfig("admin");
  const result = await sandboxPool().query("SELECT customer_account_id FROM orders o JOIN asaas_sandbox_attempts a ON a.order_id=o.id WHERE o.id=$1 AND o.payment_provider='asaas' AND o.is_demo=false", [id]);
  if (!result.rows[0]?.customer_account_id) throw new AdminError(404,"NOT_FOUND","Pedido Sandbox não encontrado.");
  return sandboxPaymentView(id, String(result.rows[0].customer_account_id), client, { allowAnyOwner: true, requireAdminMode: true });
}

export async function adminCancelSandboxAttempt(
  id: string,
  adminId: string,
  reason: string | undefined,
  client = new AsaasClient(),
) {
  sandboxConfig("admin");
  return transaction(async (tx) => {
    const a = await attempt(tx, id);
    const currentOrder = await getOrderDetail(id, tx);
    if (["paid", "refunded"].includes(currentOrder.status)) {
      throw new AdminError(
        409,
        "CANNOT_CANCEL_SETTLED",
        "Pedido já liquidado ou estornado não pode ser cancelado manualmente.",
      );
    }
    if (["canceled", "expired"].includes(currentOrder.status)) {
      await tx.query(
        "UPDATE asaas_sandbox_attempts SET state='ready',last_error_code=NULL,last_error_status=NULL,last_error_at=NULL,updated_at=now() WHERE order_id=$1",
        [id],
      );
      return { order: currentOrder };
    }
    if (a.state === "creating" || (a.method === "card" && a.state !== "prepared" && !a.provider_id)) {
      throw new AdminError(409, "CHECKOUT_PENDING_RECONCILIATION", "Aguarde a conciliação da tentativa antes de cancelar.");
    }

    const paymentsToCheck: Record<string, unknown>[] = [];
    if (a.payment_id) {
      try {
        paymentsToCheck.push(await client.request(`/payments/${resourceId(a.payment_id)}`));
      } catch (error) {
        if (!(error instanceof AsaasProviderError && error.httpStatus === 404)) throw error;
      }
    } else {
      const query = new URLSearchParams({ limit: "100" });
      if (a.method === "card" && a.provider_id) query.set("checkoutSession", a.provider_id);
      else query.set("externalReference", a.external_reference);
      const list = dataList(await client.request(`/payments?${query}`));
      for (const entry of list) {
        try {
          paymentsToCheck.push(await client.request(`/payments/${resourceId(entry.id)}`));
        } catch (error) {
          if (!(error instanceof AsaasProviderError && error.httpStatus === 404)) throw error;
        }
      }
    }

    const settled = paymentsToCheck.some((payment) => {
      verifiedPayment(payment, a, currentOrder.totalCents);
      const status = String(payment.status ?? "");
      const hasRefund = Array.isArray(payment.refunds) && payment.refunds.length > 0;
      const hasChargeback = Boolean(payment.chargeback);
      return (
        ["RECEIVED", "CONFIRMED", "REFUNDED", "REFUND_IN_PROGRESS"].includes(status) ||
        hasRefund ||
        hasChargeback
      );
    });
    if (settled) {
      throw new AdminError(
        409,
        "PAYMENT_ALREADY_CONFIRMED",
        "Cobrança já confirmada ou em estorno no Asaas; execute a reconciliação.",
      );
    }

    if (a.method === "card" && a.provider_id) {
      await client.request(`/checkouts/${resourceId(a.provider_id)}/cancel`, undefined, "POST");
    } else if (a.method === "pix") {
      for (const payment of paymentsToCheck) {
        if (payment.deleted !== true) {
          await client.request(`/payments/${resourceId(payment.id)}`, undefined, "DELETE");
        }
      }
    }

    const canceled = await cancelSandboxOrder(tx, id, adminId, reason);
    await tx.query(
      "UPDATE asaas_sandbox_attempts SET state='ready',last_error_code=NULL,last_error_status=NULL,last_error_at=NULL,updated_at=now() WHERE order_id=$1",
      [id],
    );
    return { order: canceled };
  });
}

export async function sandboxPaymentView(
  id: string,
  accountId: string,
  client = new AsaasClient(),
  options: { allowAnyOwner?: boolean; requireAdminMode?: boolean } = {},
) {
  sandboxConfig(options.requireAdminMode ? "admin" : "any");
  const db = sandboxPool();
  const result = options.allowAnyOwner
    ? await db.query("SELECT id FROM orders WHERE id=$1 AND payment_provider='asaas' AND is_demo=false", [id])
    : await db.query("SELECT id FROM orders WHERE id=$1 AND customer_account_id=$2 AND payment_provider='asaas' AND is_demo=false", [id, accountId]);
  if (!result.rows.length) throw new AdminError(404, "NOT_FOUND", "Pedido Sandbox não encontrado.");
  let warning: string | undefined;
  let diagnostic: SandboxDiagnostic | undefined;
  try { await transaction(async tx => { const a = await attempt(tx, id); await reconcile(tx, a, client, undefined, true); }); }
  catch (error) {
    if (!(error instanceof AdminError)) throw error;
    warning = error.code;
    diagnostic = diagnosticFromError(error, error.code);
    await recordAttemptDiagnostic(db, id, diagnostic);
    if (error.status === 409) await db.query("UPDATE asaas_sandbox_attempts SET state='review' WHERE order_id=$1", [id]);
  }
  const order = await getOrderDetail(id, db);
  const a = (await db.query("SELECT * FROM asaas_sandbox_attempts WHERE order_id=$1", [id])).rows[0] as Attempt;
  const productIds = Array.from(new Set(order.items.map((item) => item.productId)));
  const stockRows = productIds.length
    ? (
        await db.query(
          `SELECT p.id AS "productId", p.name AS "productName", COALESCE(i.quantity, 0)::int AS quantity
             FROM products p
             LEFT JOIN inventory i ON i.product_id = p.id
            WHERE p.id = ANY($1::text[])
            ORDER BY p.name ASC`,
          [productIds],
        )
      ).rows as Array<{ productId: string; productName: string; quantity: number }>
    : [];
  let pix: { encodedImage: string; payload: string; expirationDate: string } | undefined;
  if (a.method === "pix" && a.payment_id && order.status === "pending_payment" && a.state === "ready" && !warning) {
    try {
      const qr = await client.request(`/payments/${resourceId(a.payment_id)}/pixQrCode`);
      if (typeof qr.encodedImage !== "string" || !/^[A-Za-z0-9+/=]+$/.test(qr.encodedImage) || qr.encodedImage.length > 500_000 || typeof qr.payload !== "string" || qr.payload.length > 10_000 || typeof qr.expirationDate !== "string") throw new AdminError(502,"ASAAS_QR_INVALID","QR Pix indisponível.");
      pix = { encodedImage: qr.encodedImage, payload: qr.payload, expirationDate: qr.expirationDate };
    } catch (error) {
      warning = "ASAAS_QR_UNAVAILABLE";
      diagnostic = diagnosticFromError(error, "ASAAS_QR_UNAVAILABLE");
      await recordAttemptDiagnostic(db, id, diagnostic);
    }
  }
  if (!diagnostic && (warning || a.state === "uncertain" || a.state === "review") && a.last_error_code) {
    diagnostic = { code: a.last_error_code, httpStatus: a.last_error_status ?? null };
  }
  return { order, attemptState: a.state, environment: "sandbox" as const, sandboxStock: stockRows, ...(pix ? { pix } : {}), ...(warning ? { warning } : {}), ...(diagnostic ? { diagnostic } : {}) };
}

export function parseAsaasEvent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdminError(422,"INVALID_EVENT","Evento inválido.");
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !/^evt_[A-Za-z0-9_&-]{1,190}$/.test(v.id) || typeof v.event !== "string" || !/^[A-Z_]{1,100}$/.test(v.event)) throw new AdminError(422,"INVALID_EVENT","Evento inválido.");
  const supported = (ASAAS_EVENTS as readonly string[]).includes(v.event);
  const body = v.event.startsWith("CHECKOUT_") ? v.checkout : v.payment;
  if (supported && (!body || typeof body !== "object" || Array.isArray(body))) throw new AdminError(422,"INVALID_EVENT","Recurso do evento ausente.");
  const resource = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const id = supported ? resourceId(resource.id) : null;
  return { eventId: v.id, eventType: v.event, resourceId: id, supported, resource };
}

export async function processAsaasEvent(value: unknown, client = new AsaasClient()) {
  sandboxConfig();
  const event = parseAsaasEvent(value);
  return transaction(async tx => {
    // Asaas can deliver the same event through multiple registrations with a numeric suffix per registration.
    const canonicalId = event.eventId.replace(/&\d+$/, "");
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('th-asaas-event'), hashtext($1))", [canonicalId]);
    const previous = await tx.query(
      "SELECT 1 FROM asaas_sandbox_events WHERE event_id=$1 OR (starts_with(event_id,$1 || '&') AND substring(event_id FROM length($1) + 2) ~ '^[0-9]+$') LIMIT 1",
      [canonicalId],
    );
    if (previous.rows.length) return { received: true, result: "duplicate" };
    // The insert and state/inventory changes commit together; transient failures rollback.
    await tx.query("INSERT INTO asaas_sandbox_events(event_id,event_type,resource_id,result) VALUES($1,$2,$3,'processing')", [canonicalId,event.eventType,event.resourceId]);
    let result = "ignored_unknown";
    let orderId: string | null = null;
    if (event.supported) {
      const checkoutEvent = event.eventType.startsWith("CHECKOUT_");
      const ref = typeof event.resource.externalReference === "string" ? event.resource.externalReference : "";
      const checkout = typeof event.resource.checkoutSession === "string" ? event.resource.checkoutSession : "";
      const match = await tx.query("SELECT * FROM asaas_sandbox_attempts WHERE provider_id=$1 OR payment_id=$1 OR (provider_id=$2 AND method='card') OR (external_reference=$3 AND provider_id IS NULL) ORDER BY order_id FOR UPDATE", [event.resourceId,checkout,ref]);
      if (match.rows.length === 1) {
        const a = match.rows[0] as Attempt;
        orderId = a.order_id;
        await tx.query("SAVEPOINT provider_reconcile");
        try {
          // An authenticated checkout event can recover a lost creation response.
          // This associates the journey only; financial settlement still requires GET payments.
          if (checkoutEvent && a.method === "card" && !a.provider_id && ref === a.external_reference) {
            a.provider_id = event.resourceId!;
            await tx.query("UPDATE asaas_sandbox_attempts SET provider_id=$2,state='ready',last_error_code=NULL,last_error_status=NULL,last_error_at=NULL,updated_at=now() WHERE order_id=$1", [a.order_id,a.provider_id]);
            await tx.query("UPDATE orders SET provider_reference=$2,checkout_url=$3 WHERE id=$1 AND payment_provider='asaas' AND is_demo=false", [a.order_id,a.provider_id,checkoutUrl(a.provider_id)]);
          }
          await reconcile(tx,a,client,checkoutEvent ? undefined : event.resourceId!);
          // Checkout cancellation is an authenticated journey event, never evidence of payment.
          // No public GET checkout exists. Only a known session can release a reservation.
          if (checkoutEvent && a.provider_id === event.resourceId && ["CHECKOUT_CANCELED","CHECKOUT_EXPIRED"].includes(event.eventType)) {
            await reconcileSandboxOrder(tx,a.order_id,event.eventType === "CHECKOUT_CANCELED" ? "canceled" : "expired");
          }
          result = "reconciled";
        } catch (error) {
          if (!(error instanceof AdminError) || error.status !== 409) throw error;
          await tx.query("ROLLBACK TO SAVEPOINT provider_reconcile");
          await tx.query("UPDATE asaas_sandbox_attempts SET state='review',last_error_code=$2,last_error_status=$3,last_error_at=now(),updated_at=now() WHERE order_id=$1", [a.order_id, error.code, error.status]);
          result = error.code;
        }
      }
    }
    await tx.query("UPDATE asaas_sandbox_events SET result=$2,order_id=$3 WHERE event_id=$1",[canonicalId,result,orderId]);
    return { received: true, result };
  });
}

export async function sandboxDashboard() {
  const config = sandboxConfig("admin");
  const db = sandboxPool();
  const ids = [...config.productIds];
  const [summary, attempts, history, products] = await Promise.all([
    db.query("SELECT o.status,count(*)::int AS count,COALESCE(sum(o.total_cents),0)::bigint AS total_cents FROM orders o JOIN asaas_sandbox_attempts a ON a.order_id=o.id WHERE o.payment_provider='asaas' AND o.is_demo=false GROUP BY o.status ORDER BY o.status"),
    db.query("SELECT o.id,o.order_number,o.status,o.payment_method,o.total_cents,o.stock_status,a.state,a.last_provider_status,a.last_error_code,a.last_error_status,a.last_error_at,a.updated_at FROM asaas_sandbox_attempts a JOIN orders o ON o.id=a.order_id WHERE o.payment_provider='asaas' AND o.is_demo=false ORDER BY a.updated_at DESC LIMIT 100"),
    db.query("SELECT h.order_id,o.order_number,h.from_status,h.to_status,h.reason,h.created_at FROM order_status_history h JOIN asaas_sandbox_attempts a ON a.order_id=h.order_id JOIN orders o ON o.id=h.order_id ORDER BY h.created_at DESC LIMIT 100"),
    ids.length
      ? db.query(
          `SELECT p.id, p.sku, p.slug, p.name, p.price_cents, p.variants, COALESCE(i.quantity, 0)::int AS stock
             FROM products p
             LEFT JOIN inventory i ON i.product_id = p.id
            WHERE p.id = ANY($1::text[])
              AND p.active = true
              AND p.archived_at IS NULL
            ORDER BY p.name ASC`,
          [ids],
        )
      : Promise.resolve({ rows: [] }),
  ]);
  return {
    environment: "sandbox" as const,
    notice: "Testes sintéticos sem receita real",
    summary: summary.rows,
    attempts: attempts.rows,
    history: history.rows,
    products: products.rows as Array<{
      id: string;
      sku: string;
      slug: string;
      name: string;
      price_cents: number;
      variants: string[];
      stock: number;
    }>,
  };
}
