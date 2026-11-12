import { randomBytes, randomUUID } from "node:crypto";
import type { CustomerProfileInput } from "@/shared/contracts/customer";
import { pool, type Db } from "@/shared/server/database";
import { missing } from "@/shared/server/validation";

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
  city: string;
  state: string;
  createdAt: string;
}

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone: string;
  city: string;
  state: string;
  created_at: Date | string;
}

/** Opaque session/reset token; only its SHA-256 digest is ever persisted. */
export const newOpaqueToken = () => randomBytes(32).toString("hex");

function toRecord(row: CustomerRow): CustomerRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    phone: String(row.phone ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function createCustomerAccount(
  input: { name: string; email: string; passwordHash: string },
  db: Db = pool(),
): Promise<CustomerRecord> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO customer_accounts (id, name, email, password_hash, phone, city, state, created_at, updated_at)
     VALUES ($1, $2, $3, $4, '', '', '', $5, $5)`,
    [id, input.name, input.email, input.passwordHash, now],
  );
  return { id, name: input.name, email: input.email, passwordHash: input.passwordHash, phone: "", city: "", state: "", createdAt: now };
}

export async function findCustomerByEmail(email: string, db: Db = pool()): Promise<CustomerRecord | null> {
  const result = await db.query(
    `SELECT id, name, email, password_hash, phone, city, state, created_at
     FROM customer_accounts WHERE lower(email) = lower($1)`,
    [email],
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export async function findCustomerById(id: string, db: Db = pool()): Promise<CustomerRecord | null> {
  const result = await db.query(
    `SELECT id, name, email, password_hash, phone, city, state, created_at
     FROM customer_accounts WHERE id = $1`,
    [id],
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export async function updateCustomerProfile(id: string, input: CustomerProfileInput, db: Db = pool()): Promise<CustomerRecord> {
  const result = await db.query(
    `UPDATE customer_accounts SET name = $2, phone = $3, city = $4, state = $5, updated_at = $6
     WHERE id = $1
     RETURNING id, name, email, password_hash, phone, city, state, created_at`,
    [id, input.name, input.phone, input.city, input.state, new Date().toISOString()],
  );
  if (!result.rows[0]) missing();
  return toRecord(result.rows[0]);
}

export async function updateCustomerPassword(id: string, passwordHash: string, db: Db = pool()): Promise<void> {
  const result = await db.query(
    "UPDATE customer_accounts SET password_hash = $2, updated_at = $3 WHERE id = $1",
    [id, passwordHash, new Date().toISOString()],
  );
  if (result.rowCount === 0) missing();
}

export async function createCustomerSession(accountId: string, tokenHash: string, expiresAt: Date, db: Db = pool()): Promise<void> {
  await db.query(
    "INSERT INTO customer_sessions (token_hash, account_id, expires_at, created_at) VALUES ($1, $2, $3, $4)",
    [tokenHash, accountId, expiresAt.toISOString(), new Date().toISOString()],
  );
}

export async function findCustomerSession(tokenHash: string, db: Db = pool()): Promise<{ account: CustomerRecord; expiresAt: Date } | null> {
  const result = await db.query(
    `SELECT a.id, a.name, a.email, a.password_hash, a.phone, a.city, a.state, a.created_at, s.expires_at
     FROM customer_sessions s JOIN customer_accounts a ON a.id = s.account_id
     WHERE s.token_hash = $1`,
    [tokenHash],
  );
  if (!result.rows[0]) return null;
  return { account: toRecord(result.rows[0]), expiresAt: new Date(result.rows[0].expires_at) };
}

export async function deleteCustomerSession(tokenHash: string, db: Db = pool()): Promise<void> {
  await db.query("DELETE FROM customer_sessions WHERE token_hash = $1", [tokenHash]);
}

export async function deleteCustomerSessionsForAccount(accountId: string, db: Db = pool()): Promise<void> {
  await db.query("DELETE FROM customer_sessions WHERE account_id = $1", [accountId]);
}

export async function createPasswordReset(accountId: string, tokenHash: string, expiresAt: Date, db: Db = pool()): Promise<void> {
  await db.query(
    "INSERT INTO customer_password_resets (id, account_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)",
    [randomUUID(), accountId, tokenHash, expiresAt.toISOString(), new Date().toISOString()],
  );
}

/** Consumes a reset token atomically; returns the account id or null if invalid/expired/used. */
export async function consumePasswordReset(tokenHash: string, db: Db = pool()): Promise<string | null> {
  const result = await db.query(
    `UPDATE customer_password_resets SET used_at = $2
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING account_id`,
    [tokenHash, new Date().toISOString()],
  );
  return result.rows[0] ? String(result.rows[0].account_id) : null;
}
