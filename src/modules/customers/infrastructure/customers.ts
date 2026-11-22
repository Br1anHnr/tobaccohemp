import type { Customer } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Registered customers are the single source of truth for the admin "customers"
 * list and the dashboard KPI. They are created exclusively by the storefront
 * sign-up flow (`/api/auth/signup`), which writes to `customer_accounts`.
 *
 * The legacy `customers` table is intentionally no longer read: it predates
 * customer authentication and was never populated by a user-facing flow, so it
 * drifted to zero while real registrations accumulated in `customer_accounts`.
 * There is no deactivation concept for a customer account today, so every
 * account is reported as `active`. The password hash is never selected.
 */
export async function listCustomers(db: Db = pool()): Promise<Customer[]> {
  const result = await db.query(
    `SELECT id, name, email, created_at
       FROM customer_accounts
      ORDER BY created_at, id`,
  );
  return result.rows.map(row => ({
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    status: "active",
    createdAt: toIso(row.created_at),
  }));
}
