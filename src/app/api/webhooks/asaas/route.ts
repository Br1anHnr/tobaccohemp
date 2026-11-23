import { NextRequest, NextResponse } from "next/server";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { authenticateAsaasWebhook, isProductionAdminSandbox } from "@/modules/orders/infrastructure/asaas-client";
import { parseAsaasEvent, processAsaasEvent } from "@/modules/orders/infrastructure/asaas-sandbox";
import { jsonInput } from "@/shared/server/admin-http";
import { ensureSandboxSchema } from "@/shared/server/migrate";
import { AdminError } from "@/shared/server/validation";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    authenticateAsaasWebhook(request.headers.get("asaas-access-token"));
    const payload = await jsonInput(request);
    parseAsaasEvent(payload);
    await ensureSandboxSchema();
    const result = await processAsaasEvent(payload);
    if (!isProductionAdminSandbox()) {
      revalidateStorefrontCatalog();
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof AdminError;
    return NextResponse.json({ error: { code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "Falha temporária no webhook." } }, { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } });
  }
}
