import { expireOverdueOrders } from "@/modules/orders";
import { adminRoute } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute(async () => {
  const expired = await adminMutation((db) =>
    expireOverdueOrders({ actorType: "admin", actorId: "local-admin" }, db),
  );
  return { expiredCount: expired.length, orders: expired };
});
