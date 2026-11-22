import { listCustomers } from "@/modules/customers";
import { adminRoute } from "@/shared/server/admin-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Customers are created exclusively via the storefront sign-up flow
// (`/api/auth/signup`); the admin surface is read-only by design to avoid a
// second, divergent source of customer records.
export const GET = adminRoute(() => listCustomers(), { role: "operator" });
