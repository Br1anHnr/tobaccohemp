import { NextResponse } from "next/server";
import { invalidateSession, sessionCookie } from "@/modules/auth";
import { adminRoute } from "@/shared/server/admin-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = adminRoute(request => {
  invalidateSession(request.cookies.get(sessionCookie)?.value);
  const response = NextResponse.json({ data: null });
  response.cookies.set(sessionCookie, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0, secure: request.nextUrl.protocol === "https:" });
  return response;
});
