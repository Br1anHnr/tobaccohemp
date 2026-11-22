import { adminRoute } from "@/shared/server/admin-http";
import { sandboxDashboard } from "@/modules/orders/infrastructure/asaas-sandbox";

export const runtime = "nodejs";
export const GET = adminRoute(() => sandboxDashboard(), { role: "operator" });
