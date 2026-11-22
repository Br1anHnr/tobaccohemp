import { NextRequest, NextResponse } from "next/server";
import { customerSessionCookie, customerSessionUser } from "@/modules/auth";
import { customerRoute } from "@/shared/server/customer-http";
import { customerAuthEnabled } from "@/shared/server/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionHandler = customerRoute(
  async request => customerSessionUser(request.cookies.get(customerSessionCookie)?.value),
  { public: true },
);

export async function GET(request: NextRequest) {
  // Fast-path anonymous storefront visitors without hitting ensureSchema/DB.
  if (customerAuthEnabled() && !request.cookies.get(customerSessionCookie)?.value) {
    return NextResponse.json({ data: null }, { headers: { "Cache-Control": "no-store", Vary: "Cookie" } });
  }
  return sessionHandler(request);
}
