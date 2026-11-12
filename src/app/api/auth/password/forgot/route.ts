import { requestCustomerPasswordReset } from "@/modules/auth";
import { adminMutation } from "@/shared/server/admin-mutation";
import { customerRoute, jsonInput } from "@/shared/server/customer-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = customerRoute(async request => {
  const input = await jsonInput(request);
  return adminMutation(db => requestCustomerPasswordReset(input, db));
}, { public: true });
