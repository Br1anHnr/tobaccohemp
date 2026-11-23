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

const ALLOWED_CALLBACK_PATHS = new Set(["/admin/teste-pagamento", "/checkout"]);

export const POST = adminRoute(
  async (request, adminUser) => {
    if (!adminSandboxEnabled()) {
      throw new AdminError(503, "ASAAS_SANDBOX_NOT_CONFIGURED", "Asaas Sandbox não configurado.");
    }
    const payload = await jsonInput(request);
    let resolvedCallbackPath = "/admin/teste-pagamento";
    let orderPayload: unknown = payload;
    if (payload && typeof payload === "object" && !Array.isArray(payload) && "callbackPath" in payload) {
      const { callbackPath, ...rest } = payload as Record<string, unknown>;
      if (callbackPath !== undefined) {
        if (typeof callbackPath !== "string" || !ALLOWED_CALLBACK_PATHS.has(callbackPath)) {
          throw new AdminError(422, "VALIDATION", "Destino de retorno inválido.");
        }
        resolvedCallbackPath = callbackPath;
      }
      orderPayload = rest;
    }
    await ensureSandboxSchema();
    const customerToken = request.cookies.get(customerSessionCookie)?.value;
    const customer = customerToken ? await customerSessionUser(customerToken) : null;
    const actorAccountId = customer?.id ?? `admin-sandbox-${adminUser!.id}`;
    const result = await createSandboxPayment(
      orderPayload,
      actorAccountId,
      mutationOrigin(request),
      undefined,
      {
        callbackPath: resolvedCallbackPath,
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
