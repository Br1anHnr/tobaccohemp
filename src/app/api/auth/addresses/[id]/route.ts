import { NextRequest } from "next/server";
import { deleteCustomerAccountAddress, updateCustomerAccountAddress } from "@/modules/auth";
import { adminMutation } from "@/shared/server/admin-mutation";
import { customerRoute, jsonInput } from "@/shared/server/customer-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return customerRoute(async (req, account) => {
    const { id } = await context.params;
    const input = await jsonInput(req);
    return adminMutation((db) => updateCustomerAccountAddress(account!.id, id, input, db));
  })(request);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return customerRoute(async (_req, account) => {
    const { id } = await context.params;
    return adminMutation((db) => deleteCustomerAccountAddress(account!.id, id, db));
  })(request);
}
