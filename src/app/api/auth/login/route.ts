import { NextResponse } from "next/server";
import { signInCustomer, invalidateCustomerSession, customerSessionCookie, customerSessionSeconds } from "@/modules/auth";
import { adminMutation } from "@/shared/server/admin-mutation";
import { customerRoute, jsonInput } from "@/shared/server/customer-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = customerRoute(async request => {
  const input = await jsonInput(request);
  const { account, token } = await adminMutation(db => signInCustomer(input, db));
  await invalidateCustomerSession(request.cookies.get(customerSessionCookie)?.value);
  const response = NextResponse.json({ data: account });
  response.cookies.set(customerSessionCookie, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: customerSessionSeconds,
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}, { public: true });
