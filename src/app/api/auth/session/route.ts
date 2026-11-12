import { customerSessionCookie, customerSessionUser } from "@/modules/auth";
import { customerRoute } from "@/shared/server/customer-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = customerRoute(async request =>
  customerSessionUser(request.cookies.get(customerSessionCookie)?.value),
{ public: true });
