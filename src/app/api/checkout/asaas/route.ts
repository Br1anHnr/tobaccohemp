import { customerRoute, jsonInput } from "@/shared/server/customer-http";
import { mutationOrigin } from "@/shared/server/preview";
import { createSandboxPayment } from "@/modules/orders/infrastructure/asaas-sandbox";

export const runtime = "nodejs";
export const POST = customerRoute(async (request, account) =>
  createSandboxPayment(await jsonInput(request), account!.id, mutationOrigin(request)));
