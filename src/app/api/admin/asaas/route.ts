import { adminRoute } from "@/shared/server/admin-http";
import { ensureSandboxSchema } from "@/shared/server/migrate";
import { sandboxDashboard } from "@/modules/orders/infrastructure/asaas-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = adminRoute(async () => {
  await ensureSandboxSchema();
  return sandboxDashboard();
});
