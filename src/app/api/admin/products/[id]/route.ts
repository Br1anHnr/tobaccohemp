import { NextRequest } from "next/server";
import { saveProduct } from "@/modules/catalog";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminRoute(async request => {
    const { id } = await context.params;
    const input = await jsonInput(request);
    const product = await adminMutation(db => saveProduct(input, id, db));
    revalidateStorefrontCatalog();
    return product;
  })(request);
}

/** Soft-delete: archives the product instead of destroying its history. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminRoute(async () => {
    const { id } = await context.params;
    const product = await adminMutation(db => saveProduct({ archived: true }, id, db));
    revalidateStorefrontCatalog();
    return product;
  })(request);
}
