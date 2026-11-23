import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { customerSessionCookie, customerSessionUser } from "@/modules/auth";
import { adminSandboxEnabled, isProductionAdminSandbox } from "@/modules/orders/infrastructure/asaas-client";
import { createSandboxPayment } from "@/modules/orders/infrastructure/asaas-sandbox";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { ensureSandboxSchema } from "@/shared/server/migrate";
import { mutationOrigin } from "@/shared/server/preview";
import { AdminError } from "@/shared/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute(
  async (request, adminUser) => {
    if (!adminSandboxEnabled()) {
      throw new AdminError(503, "ASAAS_SANDBOX_NOT_CONFIGURED", "Asaas Sandbox não configurado.");
    }
    const payload = await jsonInput(request);
    await ensureSandboxSchema();
    const customerToken = request.cookies.get(customerSessionCookie)?.value;
    const customer = customerToken ? await customerSessionUser(customerToken) : null;
    const actorAccountId = customer?.id ?? `admin-sandbox-${adminUser!.id}`;
    const result = await createSandboxPayment(
      payload,
      actorAccountId,
      mutationOrigin(request),
      undefined,
      {
        callbackPath: "/admin/teste-pagamento",
        requireAdminMode: true,
      },
    );
    if (!isProductionAdminSandbox()) {
      revalidateStorefrontCatalog();
    }
    return result;
  },
  { role: "admin" },
);
