import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminReconcileSandbox } from "@/modules/orders/infrastructure/asaas-sandbox";
import { objectInput, textInput } from "@/shared/server/validation";

export const runtime = "nodejs";
export const POST = adminRoute(async request => {
  const input = objectInput(await jsonInput(request), ["orderId"]);
  const result = await adminReconcileSandbox(textInput(input.orderId, 80));
  revalidateStorefrontCatalog();
  return result;
});
