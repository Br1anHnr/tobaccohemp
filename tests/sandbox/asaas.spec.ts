import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { execFileSync } from "node:child_process";
import { pool } from "../../src/shared/server/database";
import { ensureSchema, migrations } from "../../src/shared/server/migrate";
import { signUpCustomer, customerSessionCookie } from "../../src/modules/auth";
import { createOrder, getOrderDetail, expireOverdueOrders, transitionOrderStatus } from "../../src/modules/orders";
import { createSandboxPayment, processAsaasEvent, sandboxPaymentView, sandboxDashboard } from "../../src/modules/orders/infrastructure/asaas-sandbox";
import { AsaasClient, ASAAS_SANDBOX_BASE, sandboxEnabled } from "../../src/modules/orders/infrastructure/asaas-client";
import { POST as webhook } from "../../src/app/api/webhooks/asaas/route";
import { POST as checkout } from "../../src/app/api/checkout/asaas/route";
import { GET as lookup } from "../../src/app/api/checkout/asaas/[id]/route";

test.describe.configure({ mode: "serial" });
type Payment = Record<string, unknown>;
const origin = "http://127.0.0.1:39200";
const token = process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN!;
const payments = new Map<string, Payment>();
let postCount = 0;
let sequence = 0;
let failure: "none" | "before" | "after" | "qr" | "get" = "none";
let account: { id: string; token: string };
let other: { id: string; token: string };
const requests: { url: string; init?: RequestInit }[] = [];
const mockFetch: typeof fetch = async (input, init) => {
  const url = String(input); requests.push({ url, init });
  expect(url.startsWith(ASAAS_SANDBOX_BASE + "/")).toBe(true);
  expect(init?.redirect).toBe("error");
  if (init?.method === "POST") {
    postCount++;
    if (failure === "before") throw new Error("synthetic network failure");
    const body = JSON.parse(String(init.body));
    const id = url.endsWith("/checkouts") ? `checkout_${++sequence}` : `pay_${++sequence}`;
    if (url.endsWith("/payments")) payments.set(id, { id, ...body, status: "PENDING", deleted: false });
    if (failure === "after") throw new Error("synthetic accepted then response lost");
    return Response.json({ id });
  }
  if (failure === "get") throw new Error("transient provider outage");
  if (url.includes("/pixQrCode")) {
    if (failure === "qr") return new Response("no QR", { status: 503 });
    return Response.json({ encodedImage: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", payload: "000201-SYNTHETIC-PIX", expirationDate: "2026-11-23 23:59:59" });
  }
  const parsed = new URL(url);
  const id = parsed.pathname.split("/").at(-1)!;
  if (id === "payments") return Response.json({ data: [...payments.values()].filter(p => (!parsed.searchParams.get("externalReference") || p.externalReference === parsed.searchParams.get("externalReference")) && (!parsed.searchParams.get("checkoutSession") || p.checkoutSession === parsed.searchParams.get("checkoutSession"))), hasMore: false });
  return payments.has(id) ? Response.json(payments.get(id)) : new Response("missing", { status: 404 });
};
const client = new AsaasClient(mockFetch);
const input = (key: string, paymentMethod = "pix", quantity = 1) => ({ items: [{ productId: "sandbox-accessory", quantity }], paymentMethod, idempotencyKey: key });
const event = (id: string, type: string, payment: Payment) => ({ id: `evt_${id}`, event: type, ...(type.startsWith("CHECKOUT") ? { checkout: payment } : { payment }) });
async function stock() { return Number((await pool().query("SELECT quantity FROM inventory WHERE product_id='sandbox-accessory'")).rows[0].quantity); }
async function create(key: string, method = "pix") { return createSandboxPayment(input(key,method),account.id,origin,client); }
function request(path: string, body?: unknown, headers: Record<string,string> = {}) { return new NextRequest(origin + path, { method: body ? "POST" : "GET", headers: { Host: "127.0.0.1:39200", "Content-Type": "application/json", ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }); }

test.beforeAll(async () => {
  await ensureSchema();
  await pool().query("INSERT INTO products(id,sku,name,category_slug,price_cents,active,created_at,tags) VALUES('sandbox-accessory','SYNTHETIC-CASE','Case sintético','cases',4990,true,now(),ARRAY['synthetic'])");
  await pool().query("INSERT INTO inventory(product_id,quantity,reorder_point,updated_at) VALUES('sandbox-accessory',100,1,now())");
  const first = await signUpCustomer({ name: "Teste Sandbox", email: "sandbox@example.test", password: "Synthetic-test-password123" });
  const second = await signUpCustomer({ name: "Outro Teste", email: "other@example.test", password: "Synthetic-test-password123" });
  account = { id: first.account.id, token: first.token }; other = { id: second.account.id, token: second.token };
});
test.afterAll(async () => { await pool().end(); });
test.beforeEach(() => { failure = "none"; requests.length = 0; });

test("HTTP webhook rejects missing/wrong auth and malformed payload; unknown event responds direct 200", async () => {
  expect((await webhook(request("/api/webhooks/asaas",{}))).status).toBe(401);
  expect((await webhook(request("/api/webhooks/asaas",{}, { "asaas-access-token": "wrong" }))).status).toBe(401);
  expect((await webhook(request("/api/webhooks/asaas",{}, { "asaas-access-token": token }))).status).toBe(422);
  expect((await webhook(request("/api/webhooks/asaas",{id:"evt_missing",event:"PAYMENT_RECEIVED"}, { "asaas-access-token": token }))).status).toBe(422);
  expect((await webhook(request("/api/webhooks/asaas",event("key-as-token","NEW_EVENT",{}), { "asaas-access-token": process.env.ASAAS_SANDBOX_API_KEY! }))).status).toBe(401);
  expect((await webhook(new NextRequest(origin+"/api/webhooks/asaas", {method:"POST",headers:{"Content-Type":"application/json","asaas-access-token":token},body:"{"}))).status).toBe(422);
  const response = await webhook(request("/api/webhooks/asaas",event("unknown","NEW_FUTURE_EVENT",{}), { "asaas-access-token": token }));
  expect(response.status).toBe(200); expect(response.headers.get("location")).toBeNull();
  expect((await response.json()).result).toBe("ignored_unknown");
  expect((await webhook(request("/api/webhooks/asaas",event("unknown","NEW_FUTURE_EVENT",{}), { "asaas-access-token": token }))).status).toBe(200);
});

test("migration upgrades published 18ae2b5 schema and preserves existing inventory", async () => {
  const source=execFileSync("git",["show","18ae2b5:src/shared/server/migrate.ts"],{encoding:"utf8"});
  const baseline=[...source.matchAll(/id: "([^"]+)",\s+sql: `([\s\S]*?)`/g)].map(match=>match[2]);
  expect(baseline).toHaveLength(7);
  const tx=await pool().connect();
  try {
    await tx.query("BEGIN");await tx.query("CREATE SCHEMA sandbox_upgrade");await tx.query("SET LOCAL search_path TO sandbox_upgrade");
    for(const sql of baseline)await tx.query(sql);
    await tx.query("INSERT INTO products(id,sku,name,price_cents,active,created_at) VALUES('preserved','PRESERVED','Case sintético',100,true,now())");
    await tx.query("INSERT INTO inventory(product_id,quantity,reorder_point,updated_at) VALUES('preserved',3,1,now())");
    await tx.query(migrations.at(-1)!.sql);
    expect((await tx.query("SELECT quantity FROM inventory WHERE product_id='preserved'")).rows[0].quantity).toBe(3);
    expect((await tx.query("SELECT count(*)::int AS n FROM asaas_sandbox_attempts")).rows[0].n).toBe(0);
  } finally {await tx.query("ROLLBACK");tx.release();}
});

test("HTTP creation and lookup return durable own order through session/origin wrappers", async () => {
  const original=globalThis.fetch;globalThis.fetch=mockFetch;
  try {
    const headers={Origin:origin,Cookie:`${customerSessionCookie}=${account.token}`};
    const response=await checkout(request("/api/checkout/asaas",input("http-created"),headers));
    expect(response.status).toBe(200);expect(response.headers.get("location")).toBeNull();expect(response.headers.get("cache-control")).toBe("no-store");
    const body=await response.json();expect(body.data.pix.payload).toContain("SYNTHETIC");
    const context={params:Promise.resolve({id:body.data.order.id})};
    expect((await lookup(request("/api/checkout/asaas/"+body.data.order.id,undefined,headers),context)).status).toBe(200);
    expect((await lookup(request("/api/checkout/asaas/"+body.data.order.id,undefined,{Cookie:headers.Cookie}),context)).status).toBe(403);
  } finally {globalThis.fetch=original;}
});

test("session/origin ownership and catalog guards run before provider charges", async () => {
  const headers = { Origin: origin, Cookie: `${customerSessionCookie}=${account.token}` };
  expect((await checkout(request("/api/checkout/asaas",input("no-origin")))).status).toBe(403);
  expect((await checkout(request("/api/checkout/asaas",input("no-session"),{ Origin: origin }))).status).toBe(401);
  expect((await checkout(request("/api/checkout/asaas",input("cross-origin"),{ ...headers, Origin: "https://attacker.test" }))).status).toBe(403);
  await expect(createSandboxPayment({ ...input("price-tamper"), totalCents: 1 },account.id,origin,client)).rejects.toMatchObject({ status: 422 });
  await expect(createSandboxPayment({ ...input("not-allowed"),items:[{productId:"other-product",quantity:1}] },account.id,origin,client)).rejects.toMatchObject({ status: 422 });
  const order = await create("ownership");
  await expect(sandboxPaymentView(order.order.id,other.id,client)).rejects.toMatchObject({ status: 404 });
  const response = await lookup(request(`/api/checkout/asaas/${order.order.id}`, undefined, { Origin: origin, Cookie: `${customerSessionCookie}=${other.token}` }), { params: Promise.resolve({id:order.order.id}) });
  expect(response.status).toBe(404);
});

test("concurrent idempotent creation sends one POST and reserves stock once, conflicting payload rejected", async () => {
  const before = await stock(); const posts = postCount;
  const values = await Promise.all(Array.from({length:6},() => create("concurrent")));
  expect(new Set(values.map(v => v.order.id)).size).toBe(1);
  expect(postCount - posts).toBe(1); expect(await stock()).toBe(before-1);
  expect(values.find(v => v.pix)?.pix?.payload).toContain("SYNTHETIC");
  await expect(createSandboxPayment(input("concurrent","pix",2),account.id,origin,client)).rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT"});
});

test("ambiguous POST accepted then lost is reconciled by reference without another POST", async () => {
  failure = "after"; const posts = postCount;
  const result = await create("accepted-lost");
  expect(result.attemptState).toBe("ready"); expect(result.order.providerReference).toMatch(/^pay_/);
  failure = "none"; const again = await create("accepted-lost");
  expect(again.order.id).toBe(result.order.id); expect(postCount-posts).toBe(1);
});

test("provider failure before acceptance stays uncertain and never blindly resends; QR retry is GET only", async () => {
  failure = "before"; const posts = postCount;
  const result = await create("before-failure"); expect(result.attemptState).toBe("uncertain");
  failure = "none"; await create("before-failure"); expect(postCount-posts).toBe(1);
  failure = "qr"; const qr = await create("qr-failure"); expect(qr.warning).toBe("ASAAS_QR_UNAVAILABLE");
  const qrPosts = postCount; failure = "none";
  expect((await sandboxPaymentView(qr.order.id,account.id,client)).pix).toBeDefined(); expect(postCount).toBe(qrPosts);
});

test("lost hosted checkout is recovered from authenticated unique reference without payment confirmation or POST", async () => {
  failure="after"; const posts=postCount; const result=await create("card-response-lost","card");
  expect(result.attemptState).toBe("uncertain");expect(result.order.checkoutUrl).toBeNull();
  const id=`checkout_${sequence}`;failure="none";
  await processAsaasEvent(event("checkout-recovery","CHECKOUT_CREATED",{id,externalReference:`th-sbx-${result.order.id}`}),client);
  const recovered=await sandboxPaymentView(result.order.id,account.id,client);
  expect(recovered.order.checkoutUrl).toContain(id);expect(recovered.order.status).toBe("pending_payment");expect(postCount-posts).toBe(1);
});

test("partial refunds and chargebacks enter review without double stock release", async () => {
  for (const kind of ["partial", "chargeback"]) {
    const result=await create(`review-${kind}`);const p=payments.get(result.order.providerReference!)!;const before=await stock();
    p.status="RECEIVED";
    if(kind==="partial")p.refunds=[{value:1,status:"DONE"}];else p.chargeback={status:"REQUESTED"};
    await processAsaasEvent(event(`review-${kind}`,kind==="partial"?"PAYMENT_PARTIALLY_REFUNDED":"PAYMENT_CHARGEBACK_REQUESTED",p),client);
    const view=await sandboxPaymentView(result.order.id,account.id,client);
    expect(view.attemptState).toBe("review");expect(view.order.status).toBe("pending_payment");expect(await stock()).toBe(before);
  }
});

test("provider confirmation commits stock once, duplicate/concurrent/out-of-order events do not regress", async () => {
  const result = await create("settlement"); const before = await stock();
  const p = payments.get(result.order.providerReference!)!; p.status = "RECEIVED";
  const e = event("settled", "PAYMENT_RECEIVED", p);
  const results = await Promise.all(Array.from({length:4},() => processAsaasEvent(e,client)));
  expect(results.filter(r => r.result === "duplicate")).toHaveLength(3);
  const paid = await getOrderDetail(result.order.id); expect(paid.status).toBe("paid"); expect(paid.stockStatus).toBe("committed"); expect(await stock()).toBe(before);
  p.status = "PENDING"; await processAsaasEvent(event("old-created","PAYMENT_CREATED",p),client);
  expect((await getOrderDetail(result.order.id)).status).toBe("paid");
  p.status = "REFUNDED"; await processAsaasEvent(event("refund","PAYMENT_REFUNDED",p),client);
  expect(await stock()).toBe(before+1); expect((await getOrderDetail(result.order.id)).status).toBe("refunded");
  await processAsaasEvent(event("refund-another","PAYMENT_REFUNDED",p),client); expect(await stock()).toBe(before+1);
  p.status = "RECEIVED"; await processAsaasEvent(event("old-paid","PAYMENT_RECEIVED",p),client);
  expect((await getOrderDetail(result.order.id)).status).toBe("refunded"); expect(await stock()).toBe(before+1);
});

test("value/currency/reference divergence quarantines without changing order or stock; unrelated IDs ignored", async () => {
  for (const field of ["value","currency","externalReference","billingType"]) {
    const result = await create(`divergent-${field}`); const before = await stock();
    const p = payments.get(result.order.providerReference!)!; p.status = "RECEIVED";
    p[field] = field === "value" ? 1 : field === "currency" ? "USD" : "unrelated";
    expect((await processAsaasEvent(event(`divergence-${field}`,"PAYMENT_RECEIVED",p),client)).result).toBe("ASAAS_DIVERGENCE");
    expect((await getOrderDetail(result.order.id)).status).toBe("pending_payment"); expect(await stock()).toBe(before);
  }
  expect((await processAsaasEvent(event("foreign","PAYMENT_RECEIVED",{id:"pay_foreign",externalReference:"somebody-else"}),client)).result).toBe("ignored_unknown");
});

test("transient verification failure rolls back event so retry can settle; HTTP success has no redirect", async () => {
  const result = await create("retry-webhook"); const p = payments.get(result.order.providerReference!)!; p.status = "CONFIRMED";
  const e = event("retry-event","PAYMENT_CONFIRMED",p);
  const original = globalThis.fetch; globalThis.fetch = mockFetch;
  try {
    failure = "get"; expect((await webhook(request("/api/webhooks/asaas",e,{"asaas-access-token":token}))).status).toBe(502);
    expect((await pool().query("SELECT event_id FROM asaas_sandbox_events WHERE event_id=$1",[e.id])).rows).toHaveLength(0);
    failure = "none"; const response = await webhook(request("/api/webhooks/asaas",e,{"asaas-access-token":token}));
    expect(response.status).toBe(200); expect(response.headers.get("location")).toBeNull(); expect((await getOrderDetail(result.order.id)).status).toBe("paid");
  } finally { globalThis.fetch = original; }
});

test("hosted card uses fixed Sandbox host; cancellation, late payment, refund use transactional stock", async () => {
  const result = await create("card-late","card"); const id = result.order.providerReference!; const before = await stock();
  expect(new URL(result.order.checkoutUrl!).origin).toBe("https://sandbox.asaas.com");
  const body = JSON.parse(String(requests.find(r => r.url.endsWith("/checkouts"))?.init?.body));
  expect(body.billingTypes).toEqual(["CREDIT_CARD"]); expect(body.chargeTypes).toEqual(["DETACHED"]); expect(body.creditCard).toBeUndefined();
  await processAsaasEvent(event("card-expired","CHECKOUT_EXPIRED",{id}),client);
  expect((await getOrderDetail(result.order.id)).status).toBe("expired"); expect(await stock()).toBe(before+1);
  // The GET-verified checkoutSession is the reference when not inherited by the payment.
  payments.set("pay_card_late",{id:"pay_card_late",checkoutSession:id,value:49.9,status:"CONFIRMED",billingType:"CREDIT_CARD"});
  await processAsaasEvent(event("card-paid","CHECKOUT_PAID",{id}),client);
  expect((await getOrderDetail(result.order.id)).status).toBe("paid"); expect(await stock()).toBe(before);
  await processAsaasEvent(event("late-cancel","CHECKOUT_CANCELED",{id}),client); expect(await stock()).toBe(before);
  payments.get("pay_card_late")!.status="REFUNDED";
  await processAsaasEvent(event("card-refund","PAYMENT_REFUNDED",payments.get("pay_card_late")!),client);
  expect(await stock()).toBe(before+1);
});

test("late payment with insufficient inventory is quarantined atomically and can be reconciled later", async () => {
  const result = await create("card-no-stock","card"); const id = result.order.providerReference!;
  await processAsaasEvent(event("no-stock-cancel","CHECKOUT_CANCELED",{id}),client);
  const before = await stock(); await pool().query("UPDATE inventory SET quantity=0 WHERE product_id='sandbox-accessory'");
  payments.set("pay_no_stock",{id:"pay_no_stock",checkoutSession:id,externalReference:`th-sbx-${result.order.id}`,value:49.9,status:"RECEIVED",billingType:"CREDIT_CARD"});
  expect((await processAsaasEvent(event("no-stock-paid","CHECKOUT_PAID",{id}),client)).result).toBe("LATE_PAYMENT_STOCK_REVIEW");
  expect((await getOrderDetail(result.order.id)).status).toBe("canceled"); expect(await stock()).toBe(0);
  await pool().query("UPDATE inventory SET quantity=$1 WHERE product_id='sandbox-accessory'",[before]);
  expect((await sandboxPaymentView(result.order.id,account.id,client)).order.status).toBe("paid"); expect(await stock()).toBe(before-1);
});

test("demo orders and expiry sweep remain isolated, manual Asaas transitions forbidden, dashboard separate", async () => {
  const demo = await createOrder({...input("demo-safe"),channel:"site"},{actorType:"admin"});
  const sandbox = await create("not-demo");
  await pool().query("UPDATE orders SET expires_at=now()-interval '1 day' WHERE id=ANY($1::text[])",[[demo.id,sandbox.order.id]]);
  await expireOverdueOrders(); expect((await getOrderDetail(demo.id)).status).toBe("expired"); expect((await getOrderDetail(sandbox.order.id)).status).toBe("pending_payment");
  await expect(transitionOrderStatus(sandbox.order.id,{status:"paid"},{actorType:"admin"})).rejects.toMatchObject({code:"PROVIDER_MANAGED"});
  const before = await getOrderDetail(demo.id);
  await processAsaasEvent(event("demo-attack","PAYMENT_RECEIVED",{id:demo.providerReference,externalReference:demo.id}),client);
  expect(await getOrderDetail(demo.id)).toEqual(before);
  const dashboard = await sandboxDashboard(); expect(dashboard.environment).toBe("sandbox"); expect(dashboard.attempts.some(r => r.id===demo.id)).toBe(false);
});

test("only explicit Sandbox preview branch is permitted and production stays disabled", () => {
  const saved = {...process.env};
  try {
    process.env.VERCEL="1";process.env.VERCEL_ENV="preview";process.env.PREVIEW_BACKEND_ENABLED="1";process.env.APP_ORIGIN="https://sandbox.example.test";
    process.env.VERCEL_GIT_COMMIT_REF="main";expect(sandboxEnabled()).toBe(false);
    process.env.VERCEL_GIT_COMMIT_REF="homologacao/funcional-e2e";expect(sandboxEnabled()).toBe(false);
    process.env.VERCEL_GIT_COMMIT_REF="sandbox/asaas-preview";expect(sandboxEnabled()).toBe(true);
    process.env.VERCEL_ENV="production";expect(sandboxEnabled()).toBe(false);
  } finally { process.env = saved; }
});
