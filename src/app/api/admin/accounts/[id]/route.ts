import { NextRequest } from "next/server";
import { adminAccountPatch, updateAdminAccount, revokeSessionsForAccount } from "@/modules/auth";
import { hashAdminPassword } from "@/modules/auth/infrastructure/admin-password";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Updating or deactivating an account always revokes its sessions, so a
// password change or a lockout takes effect immediately across instances.
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminRoute(async request => {
    const { id } = await context.params;
    const input = adminAccountPatch(await jsonInput(request));
    return adminMutation(async db => {
      const account = await updateAdminAccount(id, {
        name: input.name,
        role: input.role,
        active: input.active,
        passwordHash: input.password ? await hashAdminPassword(input.password) : undefined,
      }, db);
      if (input.password !== undefined || input.active === false) {
        await revokeSessionsForAccount(id, db);
      }
      return account;
    });
  })(request);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminRoute(async () => {
    const { id } = await context.params;
    // Deactivation (soft delete) preserves audit trail and revokes sessions.
    return adminMutation(async db => {
      const account = await updateAdminAccount(id, { active: false }, db);
      await revokeSessionsForAccount(id, db);
      return account;
    });
  })(request);
}
