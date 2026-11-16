import { NextRequest } from "next/server";
import { listOrderHistory } from "@/modules/orders";
import { adminRoute } from "@/shared/server/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = adminRoute((request: NextRequest) => {
  const rawLimit = request.nextUrl.searchParams.get("limit");
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : 50;
  return listOrderHistory(Number.isSafeInteger(parsed) ? parsed : 50);
});
