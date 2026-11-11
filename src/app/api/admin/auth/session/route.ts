import { sessionCookie, sessionUser } from "@/modules/auth";
import { adminRoute } from "@/shared/server/admin-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = adminRoute(request => sessionUser(request.cookies.get(sessionCookie)?.value), { public: true });
