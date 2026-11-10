import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
const error = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status, headers });

function allowed(parts: string[], method: string) {
  const path = parts.join("/");
  if (method === "GET") return ["auth/session", "customers", "products", "inventory", "dashboard"].includes(path);
  if (method === "POST") return ["auth/login", "auth/logout", "customers", "products"].includes(path);
  return method === "PATCH" && parts.length === 2 &&
    ["customers", "products", "inventory"].includes(parts[0]) && /^[a-zA-Z0-9_-]{1,128}$/.test(parts[1]);
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!["development", "test"].includes(process.env.NODE_ENV ?? "")) {
    return error(503, "UNAVAILABLE", "Integração disponível somente em desenvolvimento local.");
  }
  const { path } = await context.params;
  if (!allowed(path, request.method)) return error(404, "NOT_FOUND", "Operação não disponível.");
  const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get("host")}`;
  if (request.method !== "GET" && (request.headers.get("origin") !== expectedOrigin ||
      request.headers.get("sec-fetch-site") === "cross-site")) {
    return error(403, "INVALID_ORIGIN", "Origem inválida.");
  }

  try {
    const target = new URL(process.env.GOLDEN_IMAGE_API_ORIGIN ?? "http://127.0.0.1:3101");
    if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
        target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
      return error(503, "INVALID_CONFIGURATION", "Configure uma origem HTTP local para a Golden Image.");
    }
    if (target.origin === expectedOrigin) return error(503, "INVALID_CONFIGURATION", "Backend e dashboard precisam de portas distintas.");
    const forwardHeaders = new Headers({ Accept: "application/json", Origin: target.origin });
    const cookie = request.cookies.get("golden_admin_session")?.value;
    if (cookie && /^[a-f0-9]{64}$/.test(cookie)) forwardHeaders.set("Cookie", `golden_admin_session=${cookie}`);
    const type = request.headers.get("content-type");
    if (type) forwardHeaders.set("Content-Type", type);
    // Validate the browser's origin first, then translate it to the upstream origin.
    // No forwarded host/origin headers, account credentials or operator password are sent.
    let body: ArrayBuffer | undefined;
    if (request.method !== "GET" && request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16_384) {
          await reader.cancel();
          return error(422, "VALIDATION", "Corpo da requisição muito grande.");
        }
        chunks.push(value);
      }
      body = Uint8Array.from(Buffer.concat(chunks)).buffer;
    }
    const upstream = await fetch(new URL(`/api/admin/${path.map(encodeURIComponent).join("/")}`, target), {
      method: request.method, headers: forwardHeaders, body, cache: "no-store", redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    if (!upstream.headers.get("content-type")?.includes("application/json")) {
      await upstream.body?.cancel();
      return error(502, "UPSTREAM_ERROR", "Resposta inválida do backend local.");
    }
    const responseHeaders = new Headers({ ...headers, "Content-Type": "application/json" });
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("Set-Cookie", cookie);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return error(502, "BACKEND_UNAVAILABLE", "Backend local indisponível. Inicie a Golden Image e tente novamente.");
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
