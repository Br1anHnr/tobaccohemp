import type { NextRequest } from "next/server";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminSandboxEnabled, isProductionAdminSandbox } from "@/modules/orders/infrastructure/asaas-client";
import { sandboxAdminOrderDetail, sandboxPaymentView } from "@/modules/orders/infrastructure/asaas-sandbox";
import { adminRoute } from "@/shared/server/admin-http";
import { ensureSandboxSchema } from "@/shared/server/migrate";
import { AdminError } from "@/shared/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return adminRoute(
    async (req) => {
      if (!adminSandboxEnabled()) {
        throw new AdminError(503, "ASAAS_SANDBOX_NOT_CONFIGURED", "Asaas Sandbox não configurado.");
      }
      await ensureSandboxSchema();
      if (req.nextUrl.searchParams.get("view") === "detail") return sandboxAdminOrderDetail(id);
      const view = await sandboxPaymentView(id, "", undefined, {
        allowAnyOwner: true,
        requireAdminMode: true,
      });
      if (!isProductionAdminSandbox()) {
        revalidateStorefrontCatalog();
      }
      return view;
    },
    { role: "admin" },
  )(request);
}
