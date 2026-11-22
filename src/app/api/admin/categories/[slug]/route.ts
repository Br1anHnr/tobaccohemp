import { NextRequest } from "next/server";
import { deleteCategory, saveCategory } from "@/modules/catalog";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return adminRoute(async request => {
    const { slug } = await context.params;
    const input = await jsonInput(request);
    const category = await adminMutation(db => saveCategory(input, decodeURIComponent(slug), db));
    revalidateStorefrontCatalog();
    return category;
  })(request);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return adminRoute(async () => {
    const { slug } = await context.params;
    const result = await adminMutation(db => deleteCategory(decodeURIComponent(slug), db));
    revalidateStorefrontCatalog();
    return result;
  })(request);
}
