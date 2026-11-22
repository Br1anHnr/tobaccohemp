import { listInventory } from "@/modules/inventory";
import { adminRoute } from "@/shared/server/admin-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = adminRoute(() => listInventory(), { role: "operator" });
