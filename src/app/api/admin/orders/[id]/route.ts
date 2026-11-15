import { NextRequest } from "next/server";
import { getOrderDetail, transitionOrderStatus } from "@/modules/orders";
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
  })(request);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return adminRoute(async (req) => {
    const { id } = await context.params;
    const input = await jsonInput(req);
    return adminMutation((db) =>
      transitionOrderStatus(id, input, { actorType: "admin", actorId: "local-admin" }, db),
    );
  })(request);
}
