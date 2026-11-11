import { NextResponse } from "next/server";
import { authenticate, invalidateSession, sessionCookie, sessionSeconds } from "@/modules/auth";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = adminRoute(async request => {
  const { user, token } = authenticate(await jsonInput(request));
  invalidateSession(request.cookies.get(sessionCookie)?.value);
  const response = NextResponse.json({ data: user });
  response.cookies.set(sessionCookie, token, {
    httpOnly: true, sameSite: "strict", path: "/", maxAge: sessionSeconds,
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}, { public: true });
