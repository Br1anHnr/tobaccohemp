import { dashboardMetrics } from "@/modules/dashboard";
import { adminRoute } from "@/shared/server/admin-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = adminRoute(() => dashboardMetrics());
