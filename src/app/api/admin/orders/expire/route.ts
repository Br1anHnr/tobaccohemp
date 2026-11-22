import { expireOverdueOrders } from "@/modules/orders";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = adminRoute(async (_request, user) => {
  const expired = await adminMutation((db) =>
    expireOverdueOrders({ actorType: "admin", actorId: user?.id }, db),
  );
  if (expired.length > 0) revalidateStorefrontCatalog();
  return { expiredCount: expired.length, orders: expired };
});
