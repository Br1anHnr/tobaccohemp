import { NextResponse } from "next/server";
import { sandboxEnabled } from "@/modules/orders/infrastructure/asaas-client";

export const runtime = "nodejs";
export function GET() {
  return NextResponse.json({ data: { enabled: sandboxEnabled() } }, { headers: { "Cache-Control": "no-store" } });
}
