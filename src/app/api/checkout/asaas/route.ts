import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { customerRoute, jsonInput } from "@/shared/server/customer-http";
import { mutationOrigin } from "@/shared/server/preview";
import { AdminError } from "@/shared/server/validation";
import { sandboxEnabled } from "@/modules/orders/infrastructure/asaas-client";
import { createSandboxPayment } from "@/modules/orders/infrastructure/asaas-sandbox";

export const runtime = "nodejs";
export const POST = customerRoute(async (request, account) => {
  if (!sandboxEnabled()) {
    throw new AdminError(503, "ASAAS_SANDBOX_NOT_CONFIGURED", "Asaas Sandbox indisponível no checkout público.");
  }
  const result = await createSandboxPayment(await jsonInput(request), account!.id, mutationOrigin(request), undefined, {
    callbackPath: "/checkout",
  });
  revalidateStorefrontCatalog();
  return result;
});
