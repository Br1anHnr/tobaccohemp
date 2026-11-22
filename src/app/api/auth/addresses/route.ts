import { NextRequest } from "next/server";
import { createCustomerAccountAddress, listCustomerAccountAddresses } from "@/modules/auth";
import { adminMutation } from "@/shared/server/admin-mutation";
import { customerRoute, jsonInput } from "@/shared/server/customer-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = customerRoute((_request, account) =>
  listCustomerAccountAddresses(account!.id),
);

export async function POST(request: NextRequest) {
  return customerRoute(
    async (req, account) => {
      const input = await jsonInput(req);
      return adminMutation((db) => createCustomerAccountAddress(account!.id, input, db));
    },
    { status: 201 },
  )(request);
}
