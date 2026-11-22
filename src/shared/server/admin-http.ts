import { NextRequest, NextResponse } from "next/server";
import type { AdminRole, AdminUser } from "@/shared/contracts/admin";
import { requireRole, sessionCookie, sessionUser } from "@/modules/auth";
import { ensureSchema } from "./migrate";
import { AdminError } from "./validation";
import { mutationOrigin, previewOrigin, secureSession } from "./preview";

export type AdminHandler = (request: NextRequest, user: AdminUser | null) => unknown | Promise<unknown>;

const developmentEnvs = new Set(["development", "test"]);

/** True when the admin backend runs outside local development/test. */
export function isAdminProduction(): boolean {
  return !developmentEnvs.has(process.env.NODE_ENV ?? "");
}

/** Session cookies must be Secure over HTTPS (the only protocol used in production). */
export function isSecureRequest(request: NextRequest): boolean {
  return secureSession(request);
}

export function adminRoute(handler: AdminHandler, options: { public?: boolean; status?: number; role?: AdminRole } = {}) {
  return async (request: NextRequest) => {
    try {
      // The 503 lock stays by default outside development/test. It is released
      // only by an explicit deploy-time opt-in, never unconditionally.
      if ((process.env.VERCEL_ENV === "preview" && !previewOrigin()) ||
          (isAdminProduction() && process.env.ADMIN_ENABLED !== "1" && !previewOrigin())) {
        throw new AdminError(503, "UNAVAILABLE", "Backend administrativo desabilitado neste ambiente.");
      }
      if (!["GET", "HEAD"].includes(request.method)) {
        // Do not trust forwarded-host headers supplied by callers.
        const origin = request.headers.get("origin");
        // Next normalizes loopback URLs to localhost; Host preserves the browser's origin.
        const expectedOrigin = mutationOrigin(request);
        if (!origin || origin !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
          throw new AdminError(403, "INVALID_ORIGIN", "Origem inválida.");
        }
      }
      await ensureSchema();
      // Mutations require `admin` by default; read-only routes may opt down to
      // `operator` by passing `{ role: "operator" }`.
      const user = options.public ? null : requireRole(await sessionUser(request.cookies.get(sessionCookie)?.value), options.role ?? "admin");
      const data = await handler(request, user);
      // Handlers that complete without a body (e.g. DELETE) serialize `data`
      // as `null` instead of dropping the key, so the client can tell a
      // successful empty response apart from a malformed one.
      const response = data instanceof NextResponse ? data : NextResponse.json({ data: data ?? null }, { status: options.status ?? 200 });
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Vary", "Cookie");
      return response;
    } catch (error) {
      const known = error instanceof AdminError;
      return NextResponse.json({ error: {
        code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "Não foi possível concluir a operação.",
      } }, { status: known ? error.status : 500, headers: { "Cache-Control": "no-store", Vary: "Cookie" } });
    }
  };
}

export async function jsonInput(request: NextRequest): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new AdminError(422, "VALIDATION", "Envie um objeto JSON.");
  }
  // Limit the streamed body as well as Content-Length, which may be missing or untrusted.
  const reader = request.body?.getReader();
  if (!reader) throw new AdminError(422, "VALIDATION", "Envie um objeto JSON.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16_384) {
      await reader.cancel();
      throw new AdminError(422, "VALIDATION", "Corpo da requisição muito grande.");
    }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new AdminError(422, "VALIDATION", "JSON inválido."); }
}
