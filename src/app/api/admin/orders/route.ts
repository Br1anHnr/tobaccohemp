import { createOrder, listOrders } from "@/modules/orders";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(() => listOrders());

export const POST = adminRoute(
  async (request) => {
    const input = await jsonInput(request);
    return adminMutation((db) =>
      createOrder(input, { actorType: "admin", actorId: "local-admin" }, db),
    );
  },
  { status: 201 },
);
