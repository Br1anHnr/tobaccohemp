import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
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
  const result = await adminCancelSandboxAttempt(orderId, user!.id, reason);
  revalidateStorefrontCatalog();
  return result;
});
