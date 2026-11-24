import { sessionCookie, sessionUser } from "@/modules/auth";
import { listCustomerOrders, type CustomerOrderDetail } from "@/modules/orders";
import { isProductionAdminSandbox } from "@/modules/orders/infrastructure/asaas-client";
import { sandboxCustomerAllowed } from "@/modules/orders/infrastructure/asaas-customer-access";
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
  const allowed = await sandboxCustomerAllowed(account!.id);
  const adminUser = allowed ? null : await sessionUser(request.cookies.get(sessionCookie)?.value);
  if (!allowed && adminUser?.role !== "admin") {
    return orders;
  }
  await ensureSandboxSchema();
  const sandboxOrders = (await listCustomerOrders(account!.id, sandboxPool()))
    .filter(order => order.paymentProvider === "asaas" && !order.isDemo)
    .map(
    (order): CustomerOrderDetail => ({
      ...order,
      attemptState: null,
      lastProviderStatus: null,
      history: order.history.map(({ id, orderId, fromStatus, toStatus, createdAt }) => ({
        id, orderId, fromStatus, toStatus, createdAt, actorType: "system", actorId: null, reason: "",
      })),
      detailPath: `${allowed ? "/pedido-confirmado" : "/checkout"}?asaasOrder=${encodeURIComponent(order.id)}`,
    }),
  );
  const merged = [...sandboxOrders, ...orders];
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
});
