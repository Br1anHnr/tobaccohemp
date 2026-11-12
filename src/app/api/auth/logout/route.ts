import { NextResponse } from "next/server";
import { invalidateCustomerSession, customerSessionCookie } from "@/modules/auth";
import { adminMutation } from "@/shared/server/admin-mutation";
import { customerRoute } from "@/shared/server/customer-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = customerRoute(async request => {
  await adminMutation(db => invalidateCustomerSession(request.cookies.get(customerSessionCookie)?.value, db));
  const response = NextResponse.json({ data: null });
  response.cookies.set(customerSessionCookie, "", {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 0,
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}, { public: true });
