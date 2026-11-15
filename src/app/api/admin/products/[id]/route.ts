import { NextRequest } from "next/server";
import { saveProduct } from "@/modules/catalog";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminRoute(async request => {
    const { id } = await context.params;
    const input = await jsonInput(request);
    return adminMutation(db => saveProduct(input, id, db));
  })(request);
}

/** Soft-delete: archives the product instead of destroying its history. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminRoute(async () => {
    const { id } = await context.params;
    return adminMutation(db => saveProduct({ archived: true }, id, db));
  })(request);
}
