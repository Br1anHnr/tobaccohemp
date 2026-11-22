import { NextRequest } from "next/server";
import { getOrderDetail, transitionOrderStatus } from "@/modules/orders";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return adminRoute(async () => {
    const { id } = await context.params;
    return getOrderDetail(id);
  }, { role: "operator" })(request);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return adminRoute(async (req, user) => {
    const { id } = await context.params;
    const input = await jsonInput(req);
    const updated = await adminMutation((db) =>
      transitionOrderStatus(id, input, { actorType: "admin", actorId: user?.id }, db),
    );
    revalidateStorefrontCatalog();
    return updated;
  })(request);
}
