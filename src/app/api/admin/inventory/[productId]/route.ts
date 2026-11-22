import { NextRequest } from "next/server";
import { saveInventory } from "@/modules/inventory";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
  return adminRoute(async request => {
    const { productId } = await context.params;
    const input = await jsonInput(request);
    const updated = await adminMutation(db => saveInventory(input, productId, db));
    revalidateStorefrontCatalog();
    return updated;
  })(request);
}
