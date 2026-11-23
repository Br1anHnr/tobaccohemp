import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { isProductionAdminSandbox } from "@/modules/orders/infrastructure/asaas-client";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { ensureSandboxSchema } from "@/shared/server/migrate";
import { adminReconcileSandbox } from "@/modules/orders/infrastructure/asaas-sandbox";
import { objectInput, textInput } from "@/shared/server/validation";

export const runtime = "nodejs";
export const POST = adminRoute(async request => {
  const input = objectInput(await jsonInput(request), ["orderId"]);
  await ensureSandboxSchema();
  const result = await adminReconcileSandbox(textInput(input.orderId, 80));
  if (!isProductionAdminSandbox()) {
    revalidateStorefrontCatalog();
  }
  return result;
});
