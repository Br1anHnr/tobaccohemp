import { listCategories, saveCategory } from "@/modules/catalog";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = adminRoute(() => listCategories(), { role: "operator" });
export const POST = adminRoute(async request => {
  const input = await jsonInput(request);
  const category = await adminMutation(db => saveCategory(input, undefined, db));
  revalidateStorefrontCatalog();
  return category;
}, { status: 201 });
