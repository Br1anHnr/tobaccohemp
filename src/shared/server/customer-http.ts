import { NextRequest, NextResponse } from "next/server";
import type { CustomerAccount } from "@/shared/contracts/customer";
import { customerSessionCookie, customerSessionUser } from "@/modules/auth";
import { jsonInput } from "./admin-http";
import { ensureSchema } from "./migrate";
import { AdminError } from "./validation";

export type CustomerHandler = (
  request: NextRequest,
  account: CustomerAccount | null,
) => unknown | Promise<unknown>;

/**
 * Wrapper for the customer storefront routes: environment gate, CSRF origin
 * check, schema migrations, optional session resolution and JSON error shape.
 */
export function customerRoute(
  handler: CustomerHandler,
  options: { public?: boolean; status?: number } = {},
) {
  return async (request: NextRequest) => {
    try {
      if (!["development", "test"].includes(process.env.NODE_ENV ?? "")) {
        throw new AdminError(503, "UNAVAILABLE", "Autenticação de clientes disponível apenas em desenvolvimento local.");
      }
      if (!["GET", "HEAD"].includes(request.method)) {
        const origin = request.headers.get("origin");
        const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get("host")}`;
        if (!origin || origin !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
          throw new AdminError(403, "INVALID_ORIGIN", "Origem inválida.");
        }
      }
      await ensureSchema();
      let account: CustomerAccount | null = null;
      if (!options.public) {
        account = await customerSessionUser(request.cookies.get(customerSessionCookie)?.value);
        if (!account) throw new AdminError(401, "UNAUTHENTICATED", "Autenticação necessária.");
      }
      const data = await handler(request, account);
      const response = data instanceof NextResponse ? data : NextResponse.json({ data }, { status: options.status ?? 200 });
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

export { jsonInput };
