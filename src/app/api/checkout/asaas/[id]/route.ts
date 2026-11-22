import type { NextRequest } from "next/server";
import { customerRoute } from "@/shared/server/customer-http";
import { mutationOrigin } from "@/shared/server/preview";
import { AdminError } from "@/shared/server/validation";
import { sandboxPaymentView } from "@/modules/orders/infrastructure/asaas-sandbox";

export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return customerRoute(async (req, account) => {
    const origin = req.headers.get("origin");
    if ((origin && origin !== mutationOrigin(req)) || req.headers.get("sec-fetch-site") === "cross-site" || (!origin && req.headers.get("sec-fetch-site") !== "same-origin")) throw new AdminError(403,"INVALID_ORIGIN","Origem inválida.");
    return sandboxPaymentView(id, account!.id);
  })(request);
}
