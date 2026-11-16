import { listProducts, saveProduct } from "@/modules/catalog";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = adminRoute(() => listProducts(), { role: "operator" });
export const POST = adminRoute(async request => {
  const input = await jsonInput(request);
  return adminMutation(db => saveProduct(input, undefined, db));
}, { status: 201 });
