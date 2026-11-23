import { sessionCookie, sessionUser } from "@/modules/auth";
import { listCustomerOrders, type CustomerOrderDetail } from "@/modules/orders";
import { isProductionAdminSandbox } from "@/modules/orders/infrastructure/asaas-client";
import { customerRoute } from "@/shared/server/customer-http";
import { sandboxPool } from "@/shared/server/database";
import { ensureSandboxSchema } from "@/shared/server/migrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = customerRoute(async (request, account) => {
  const orders = await listCustomerOrders(account!.id);
  if (!isProductionAdminSandbox()) {
    return orders;
  }
  const adminUser = await sessionUser(request.cookies.get(sessionCookie)?.value);
  if (adminUser?.role !== "admin") {
    return orders;
  }
  await ensureSandboxSchema();
  const sandboxOrders = (await listCustomerOrders(account!.id, sandboxPool())).map(
    (order): CustomerOrderDetail => ({
      ...order,
      detailPath: `/admin/teste-pagamento?asaasOrder=${encodeURIComponent(order.id)}`,
    }),
  );
  const merged = [...sandboxOrders, ...orders];
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
});
