import { NextRequest } from "next/server";
import { updateCustomerProfile } from "@/modules/auth";
import { adminMutation } from "@/shared/server/admin-mutation";
import { customerRoute, jsonInput } from "@/shared/server/customer-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = customerRoute((_request, account) => account);
export async function PATCH(request: NextRequest) {
  return customerRoute(async (request, account) => {
    const input = await jsonInput(request);
    return adminMutation(db => updateCustomerProfile(account!.id, input, db));
  })(request);
}
