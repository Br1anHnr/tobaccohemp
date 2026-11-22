import { listCustomerOrders } from "@/modules/orders";
import { customerRoute } from "@/shared/server/customer-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = customerRoute((_request, account) =>
  listCustomerOrders(account!.id),
);
