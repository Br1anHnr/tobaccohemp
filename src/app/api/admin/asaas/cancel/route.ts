import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { isProductionAdminSandbox } from "@/modules/orders/infrastructure/asaas-client";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { ensureSandboxSchema } from "@/shared/server/migrate";
import { adminCancelSandboxAttempt } from "@/modules/orders/infrastructure/asaas-sandbox";
import { objectInput, textInput } from "@/shared/server/validation";

export const runtime = "nodejs";
export const POST = adminRoute(async (request, user) => {
  const raw = await jsonInput(request);
  const input = objectInput(raw, ["orderId", "reason"], true);
  const orderId = textInput(input.orderId, 80);
  const reason =
    input.reason === undefined || input.reason === null || input.reason === ""
      ? undefined
      : textInput(input.reason, 240);
  await ensureSandboxSchema();
  const result = await adminCancelSandboxAttempt(orderId, user!.id, reason);
  if (!isProductionAdminSandbox()) {
    revalidateStorefrontCatalog();
  }
  return result;
});
