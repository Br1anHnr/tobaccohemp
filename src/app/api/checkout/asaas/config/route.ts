import { NextRequest, NextResponse } from "next/server";
import { customerSessionCookie, customerSessionUser, sessionCookie, sessionUser } from "@/modules/auth";
import { sandboxCustomerAllowed } from "@/modules/orders/infrastructure/asaas-customer-access";
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
    const customerToken = request?.cookies.get(customerSessionCookie)?.value;
    const adminToken = request?.cookies.get(sessionCookie)?.value;
    if (customerToken || adminToken) {
      try {
        await ensureSchema();
        const customer = customerToken ? await customerSessionUser(customerToken) : null;
        if (customer && await sandboxCustomerAllowed(customer.id)) {
          return NextResponse.json(
            { data: { enabled: true, mode: "customer_sandbox" as const } },
            { headers },
          );
        }
        const adminUser = adminToken ? await sessionUser(adminToken) : null;
        if (adminUser?.role === "admin") {
          return NextResponse.json(
            { data: { enabled: true, mode: "admin_sandbox" as const } },
            { headers },
          );
        }
      } catch {
        return NextResponse.json(
          { error: { message: "Não foi possível verificar a disponibilidade do checkout." } },
          { status: 503, headers },
        );
      }
    }
  }
  return NextResponse.json(
    { data: { enabled: false, mode: "disabled" as const } },
    { headers },
  );
}
