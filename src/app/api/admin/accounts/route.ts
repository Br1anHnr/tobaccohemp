import { createAdminAccount, listAdminAccounts } from "@/modules/auth";
import { adminAccountInput } from "@/modules/auth";
import { hashAdminPassword } from "@/modules/auth/infrastructure/admin-password";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Both are admin-only (the default role), so operators can never manage accounts.
export const GET = adminRoute(() => listAdminAccounts());

export const POST = adminRoute(async request => {
  const input = adminAccountInput(await jsonInput(request));
  const passwordHash = await hashAdminPassword(input.password);
  return adminMutation(db =>
    createAdminAccount({ name: input.name, email: input.email, role: input.role, passwordHash }, db),
  );
}, { status: 201 });
