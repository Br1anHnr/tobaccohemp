import { createOrder, listOrders } from "@/modules/orders";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";
import { AdminError } from "@/shared/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute(() => listOrders(), { role: "operator" });

export const POST = adminRoute(
  async (request, user) => {
    const raw = await jsonInput(request);
    const headerKey = request.headers.get("idempotency-key")?.trim();
    let payload = raw;
    if (headerKey && raw && typeof raw === "object" && !Array.isArray(raw)) {
      const record = raw as Record<string, unknown>;
      if (
        typeof record.idempotencyKey === "string" &&
        record.idempotencyKey.trim() &&
        record.idempotencyKey.trim() !== headerKey
      ) {
        throw new AdminError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Cabeçalho Idempotency-Key diverge da chave informada no corpo.",
        );
      }
      payload = { ...record, idempotencyKey: record.idempotencyKey || headerKey };
    }
    const order = await adminMutation((db) =>
      createOrder(payload, { actorType: "admin", actorId: user?.id }, db),
    );
    revalidateStorefrontCatalog();
    return order;
  },
  { status: 201 },
);
