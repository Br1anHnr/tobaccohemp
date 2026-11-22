// Isolated local validation only: synthetic credentials, no .env loading here.
// Prerequisites: dedicated Postgres :55465, Mailpit :18025, local TLS cert/key.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import https from "node:https";
import http from "node:http";
import { chromium, request as playwrightRequest } from "@playwright/test";
import { Pool } from "pg";

const origin = "https://localhost:3331";
const database = "postgresql://postgres:synthetic-preview-only@127.0.0.1:55465/preview_validation";
const env = Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "COMSPEC", "PATHEXT"].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, { NODE_ENV: "production", PREVIEW_VALIDATION: "1", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: database,
  ADMIN_EMAIL: "admin@example.test", ADMIN_PASSWORD: "synthetic-preview-password", ADMIN_ENABLED: "0", VERCEL: "",
  VERCEL_ENV: "", VERCEL_GIT_COMMIT_REF: "", PREVIEW_BACKEND_ENABLED: "0", APP_ORIGIN: "", MAILPIT_URL: "",
  R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "", R2_BUCKET: "", R2_PUBLIC_URL: "" });
const preview = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "homologacao/funcional-e2e", PREVIEW_BACKEND_ENABLED: "1", APP_ORIGIN: origin, MAILPIT_URL: "http://127.0.0.1:18025" };
const results = [];
let server;
const proxy = https.createServer({ key: readFileSync(".preview-validation/key.pem"), cert: readFileSync(".preview-validation/cert.pem") }, (req, res) => {
  const upstream = http.request({ hostname: "127.0.0.1", port: 3330, path: req.url, method: req.method,
    headers: { ...req.headers, "x-forwarded-proto": "https" } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); }); req.pipe(upstream);
});
await new Promise(resolve => proxy.listen(3331, "127.0.0.1", resolve));
const api = await playwrightRequest.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
const post = (path, data, headers = {}) => api.post(path, { data, headers: { Origin: origin, ...headers } });
async function stop() {
  if (!server) return;
  const child = server; server = null;
  const done = new Promise(resolve => child.once("exit", resolve)); child.kill(); await done;
}
async function start(extra) {
  await stop();
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3330"], { env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  server.stdout.on("data", c => { output += c; }); server.stderr.on("data", c => { output += c; });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Next exited: ${output}`);
    if (output.includes("Ready in")) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Next start timed out: ${output}`);
}
async function locked(label, extra) {
  await start(extra);
  assert.equal((await api.get("/api/auth/session")).status(), 503);
  assert.equal((await api.get("/api/admin/auth/session")).status(), 503);
  results.push(label);
}
try {
  await locked("production default: customer + admin 503", {});
  await locked("preview missing opt-in: 503 even with ADMIN_ENABLED", { ...preview, PREVIEW_BACKEND_ENABLED: "0", ADMIN_ENABLED: "1" });
  await locked("preview wrong branch: 503", { ...preview, VERCEL_GIT_COMMIT_REF: "other" });
  await locked("preview insecure origin: 503", { ...preview, APP_ORIGIN: "http://localhost:3331" });
  await locked("production ignores preview opt-in", { ...preview, VERCEL_ENV: "production" });
  await start(preview);
  assert.equal((await api.get("/api/auth/profile")).status(), 401);
  assert.equal((await post("/api/auth/signup", {}, { Origin: "https://attacker.invalid", "x-forwarded-host": "attacker.invalid" })).status(), 403);
  assert.equal((await post("/api/auth/signup", {}, { "Sec-Fetch-Site": "cross-site" })).status(), 403);
  assert.equal((await api.post("/api/auth/signup", { data: {} })).status(), 403);
  const email = `preview-${Date.now()}@example.test`;
  const password = "synthetic-customer-password123";
  const signup = await post("/api/auth/signup", { name: "Cliente Preview", email, phone: "11999990000", password });
  assert.equal(signup.status(), 201);
  assert.match(signup.headers()["set-cookie"], /HttpOnly/); assert.match(signup.headers()["set-cookie"], /Secure/);
  assert.equal((await (await api.get("/api/auth/session")).json()).data.email, email);
  const cookies = (await api.storageState()).cookies;
  const browser = await chromium.launch();
  for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport, reducedMotion: "reduce" });
    await context.addCookies(cookies);
    const page = await context.newPage();
    await page.goto(`${origin}/conta`);
    const age = page.getByRole("button", { name: "Sim, tenho 18+" });
    await age.waitFor(); await age.click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.locator(".account-hello").filter({ hasText: "Cliente" }).waitFor();
    await page.reload();
    await page.locator(".account-hello").filter({ hasText: "Cliente" }).waitFor();
    assert.ok((await page.content()).includes(email));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `.preview-validation/account-${name}.png`, fullPage: true });
    await context.close();
  }
  await browser.close();
  results.push("HTTPS browser desktop/mobile: authenticated SSR + reload, Secure HttpOnly cookies; CSRF rejected");
  const admin = await post("/api/admin/auth/login", { email: "admin@example.test", password: env.ADMIN_PASSWORD });
  assert.equal(admin.status(), 200); assert.match(admin.headers()["set-cookie"], /Secure/);
  assert.equal((await api.get("/api/admin/dashboard")).status(), 200);
  assert.equal((await post("/api/admin/products", {}, { Origin: "https://attacker.invalid" })).status(), 403);
  const created = await post("/api/admin/products", { name: `Acessório Preview ${Date.now()}`, sku: `PREVIEW-${Date.now()}`, priceCents: 1990, active: true });
  assert.equal(created.status(), 201);
  const productId = (await created.json()).data.id;
  const upload = await api.post(`/api/admin/products/${productId}/images`, { headers: { Origin: origin }, multipart: {
    file: { name: "pixel.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") } } });
  assert.equal(upload.status(), 503); assert.equal((await upload.json()).error.code, "STORAGE_NOT_CONFIGURED");
  results.push("admin login/dashboard/CRUD; R2 absent -> upload 503 without local fallback");
  const forgot = await post("/api/auth/password/forgot", { email });
  assert.equal(forgot.status(), 200); assert.equal((await forgot.json()).data.resetToken, undefined);
  const messages = await (await fetch("http://127.0.0.1:18025/api/v1/messages")).json();
  const message = await (await fetch(`http://127.0.0.1:18025/api/v1/message/${messages.messages[0].ID}`)).json();
  const link = new URL(message.Text.match(/https:\/\/\S+/)[0]);
  assert.equal(link.origin, origin); const token = link.searchParams.get("token"); assert.ok(token);
  const reset = await post("/api/auth/password/reset", { token, password: "changed-synthetic-password456" });
  assert.equal(reset.status(), 200); assert.deepEqual(await reset.json(), { data: null });
  assert.equal((await (await api.get("/api/auth/session")).json()).data, null);
  assert.equal((await post("/api/auth/password/reset", { token, password })).status(), 400);
  assert.equal((await post("/api/auth/login", { email, password: "changed-synthetic-password456" })).status(), 200);
  await start(preview);
  assert.equal((await (await api.get("/api/auth/session")).json()).data.email, email);
  assert.equal((await api.get("/api/admin/dashboard")).status(), 200);
  results.push("Mailpit capture: configured HTTPS link, no response token, reset once, session revocation + restart persistence");
  await start({ ...preview, MAILPIT_URL: "https://public-mail.invalid" });
  for (const target of [email, "missing@example.test"]) {
    const response = await post("/api/auth/password/forgot", { email: target });
    assert.equal(response.status(), 503); assert.equal((await response.json()).error.code, "MAIL_NOT_CONFIGURED");
  }
  await start({ ...preview, MAILPIT_URL: "" });
  assert.equal((await post("/api/auth/password/forgot", { email })).status(), 503);
  results.push("public/missing mail sandbox blocked before account lookup");
  const pool = new Pool({ connectionString: database });
  assert.equal(Number((await pool.query("SELECT count(*) FROM product_images WHERE product_id=$1", [productId])).rows[0].count), 0);
  await pool.query("DELETE FROM products WHERE id=$1", [productId]);
  await pool.query("DELETE FROM customer_accounts WHERE email=$1", [email]); await pool.end();
  mkdirSync(".preview-validation", { recursive: true });
  writeFileSync(".preview-validation/results.json", JSON.stringify(results, null, 2));
  console.log(results.join("\n"));
} finally { await stop(); await api.dispose(); proxy.close(); }
