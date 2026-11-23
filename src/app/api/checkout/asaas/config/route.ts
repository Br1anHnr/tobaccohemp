import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, sessionUser } from "@/modules/auth";
import { isProductionAdminSandbox, sandboxEnabled } from "@/modules/orders/infrastructure/asaas-client";
import { ensureSchema } from "@/shared/server/migrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request?: NextRequest) {
  const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
  if (sandboxEnabled()) {
    return NextResponse.json(
      { data: { enabled: true, mode: "preview_sandbox" as const } },
      { headers },
    );
  }
  if (isProductionAdminSandbox()) {
    const token = request?.cookies.get(sessionCookie)?.value;
    if (token) {
      try {
        await ensureSchema();
        const adminUser = await sessionUser(token);
        if (adminUser?.role === "admin") {
          return NextResponse.json(
            { data: { enabled: true, mode: "admin_sandbox" as const } },
            { headers },
          );
        }
      } catch {
        // Fail closed when admin session lookup is unavailable.
      }
    }
  }
  return NextResponse.json(
    { data: { enabled: false, mode: "disabled" as const } },
    { headers },
  );
}
