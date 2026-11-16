import { randomUUID } from "node:crypto";
import type { AdminAccount, AdminRole, AdminUser } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";
import { duplicate, missing } from "@/shared/server/validation";
import { hashAdminPassword } from "./admin-password";

export interface AdminAccountRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminAccountRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

function toRecord(row: AdminAccountRow): AdminAccountRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    role: row.role === "admin" ? "admin" : "operator",
    active: Boolean(row.active),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

/** Wire view never leaks the password hash. */
export function toAdminUser(record: AdminAccountRecord): AdminUser {
  return { id: record.id, name: record.name, email: record.email, role: record.role };
}

export function toAdminAccount(record: AdminAccountRecord): AdminAccount {
  return {
    id: record.id, name: record.name, email: record.email, role: record.role,
    active: record.active, createdAt: record.createdAt, updatedAt: record.updatedAt,
  };
}

export async function findAdminByEmail(email: string, db: Db = pool()): Promise<AdminAccountRecord | null> {
  const result = await db.query(
    `SELECT id, name, email, password_hash, role, active, created_at, updated_at
     FROM admin_accounts WHERE lower(email) = lower($1)`,
    [email],
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export async function findAdminById(id: string, db: Db = pool()): Promise<AdminAccountRecord | null> {
  const result = await db.query(
    `SELECT id, name, email, password_hash, role, active, created_at, updated_at
     FROM admin_accounts WHERE id = $1`,
    [id],
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export async function listAdminAccounts(db: Db = pool()): Promise<AdminAccount[]> {
  const result = await db.query(
    `SELECT id, name, email, password_hash, role, active, created_at, updated_at
     FROM admin_accounts ORDER BY lower(email) ASC`,
  );
  return result.rows.map((row) => toAdminAccount(toRecord(row)));
}

export async function createAdminAccount(
  input: { name: string; email: string; passwordHash: string; role: AdminRole },
  db: Db = pool(),
): Promise<AdminAccount> {
  if (await findAdminByEmail(input.email, db)) duplicate();
  const now = new Date().toISOString();
  const result = await db.query(
    `INSERT INTO admin_accounts (id, name, email, password_hash, role, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, true, $6, $6)
     RETURNING id, name, email, password_hash, role, active, created_at, updated_at`,
    [randomUUID(), input.name, input.email, input.passwordHash, input.role, now],
  );
  return toAdminAccount(toRecord(result.rows[0]));
}

export async function updateAdminAccount(
  id: string,
  input: { name?: string; passwordHash?: string; role?: AdminRole; active?: boolean },
  db: Db = pool(),
): Promise<AdminAccount> {
  const existing = await findAdminById(id, db);
  if (!existing) missing();

  const name = input.name ?? existing.name;
  const role = input.role ?? existing.role;
  const active = input.active ?? existing.active;
  const passwordHash = input.passwordHash ?? existing.passwordHash;
  const updatedAt = new Date().toISOString();

  const result = await db.query(
    `UPDATE admin_accounts
     SET name = $2, role = $3, active = $4, password_hash = $5, updated_at = $6
     WHERE id = $1
     RETURNING id, name, email, password_hash, role, active, created_at, updated_at`,
    [id, name, role, active, passwordHash, updatedAt],
  );
  return toAdminAccount(toRecord(result.rows[0]));
}

/** Revoke every live session for an account (password rotation / deactivation). */
export async function deleteAdminSessionsForAccount(accountId: string, db: Db = pool()): Promise<void> {
  await db.query("DELETE FROM admin_sessions WHERE admin_id = $1", [accountId]);
}

/** Persist only the digest of an opaque session token, bound to a real account. */
export async function createAdminSession(accountId: string, tokenHash: string, expiresAt: Date, db: Db = pool()): Promise<void> {
  await db.query(
    "INSERT INTO admin_sessions (token_hash, admin_id, expires_at, created_at) VALUES ($1, $2, $3, $4)",
    [tokenHash, accountId, expiresAt.toISOString(), new Date().toISOString()],
  );
}

/**
 * Idempotently seed the bootstrap admin account from deployment configuration.
 * Runs after migrations inside `ensureSchema`; only creates the account when it
 * does not exist yet, so later deployments never reset a real password.
 */
export async function bootstrapAdminAccount(db: Db = pool()): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? "admin@example.test").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) return;
  if (await findAdminByEmail(email, db)) return;
  await createAdminAccount(
    { name: "Administrador", email, passwordHash: await hashAdminPassword(password), role: "admin" },
    db,
  );
}
