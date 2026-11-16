import { listCategories, saveCategory } from "@/modules/catalog";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = adminRoute(() => listCategories(), { role: "operator" });
export const POST = adminRoute(async request => {
  const input = await jsonInput(request);
  return adminMutation(db => saveCategory(input, undefined, db));
}, { status: 201 });
