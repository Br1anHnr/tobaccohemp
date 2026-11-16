import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AdminRole, AdminUser } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";
import { AdminError, objectInput, textInput } from "@/shared/server/validation";
import {
  createAdminSession,
  deleteAdminSessionsForAccount,
  findAdminByEmail,
  toAdminUser,
  type AdminAccountRecord,
} from "./admin-accounts";
import { verifyAdminPassword } from "./admin-password";

export const sessionCookie = "th_admin_session";
export const sessionSeconds = 30 * 60;

const ATTEMPT_WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const MAX_SESSIONS = 100;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const ROLE_RANK: Record<AdminRole, number> = { operator: 1, admin: 2 };

/**
 * Persistent login throttling. Attempts live in PostgreSQL so the admin backend
 * behaves correctly on serverless deployments (Vercel), where an in-memory Map
 * would not survive cold starts or scale across instances. Only failed logins
 * are recorded, so a successful sign-in never contributes to the lockout.
 */
async function throttleCheck(db: Db): Promise<void> {
  const now = Date.now();
  await db.query(
    "DELETE FROM admin_login_attempts WHERE attempted_at < $1",
    [new Date(now - ATTEMPT_WINDOW_MS).toISOString()],
  );
  const result = await db.query("SELECT count(*) AS n FROM admin_login_attempts");
  if (Number(result.rows[0]?.n ?? 0) >= MAX_ATTEMPTS) {
    throw new AdminError(429, "RATE_LIMIT", "Aguarde antes de tentar novamente.");
  }
}

async function recordFailure(db: Db): Promise<void> {
  await db.query(
    "INSERT INTO admin_login_attempts (id, attempted_at) VALUES ($1, $2)",
    [randomUUID(), new Date().toISOString()],
  );
}

export async function authenticate(value: unknown, db: Db = pool()): Promise<{ user: AdminUser; token: string }> {
  await throttleCheck(db);

  const input = objectInput(value, ["email", "password"]);
  const email = textInput(input.email, 254).toLowerCase();
  // Do not trim passwords: leading/trailing spaces can be intentional.
  if (typeof input.password !== "string" || input.password.length > 1024) {
    throw new AdminError(422, "VALIDATION", "Dados inválidos.");
  }

  const record: AdminAccountRecord | null = await findAdminByEmail(email, db);
  const valid = record ? await verifyAdminPassword(input.password, record.passwordHash) : false;
  if (!record || !valid || !record.active) {
    await recordFailure(db);
    throw new AdminError(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");
  }

  // Reap expired rows and cap the number of live sessions (defense in depth).
  await db.query("DELETE FROM admin_sessions WHERE expires_at <= now()");
  const count = await db.query("SELECT count(*) AS n FROM admin_sessions");
  if (Number(count.rows[0]?.n ?? 0) >= MAX_SESSIONS) {
    await db.query(
      "DELETE FROM admin_sessions WHERE token_hash = (SELECT token_hash FROM admin_sessions ORDER BY created_at ASC LIMIT 1)",
    );
  }

  // Persist only the SHA-256 digest of the opaque token, never the raw cookie.
  const token = randomBytes(32).toString("hex");
  await createAdminSession(record.id, sha256(token), new Date(Date.now() + sessionSeconds * 1000), db);
  return { user: toAdminUser(record), token };
}

export async function sessionUser(token: string | undefined, db: Db = pool()): Promise<AdminUser | null> {
  if (!token) return null;
  const tokenHash = sha256(token);
  const result = await db.query(
    `SELECT a.id, a.name, a.email, a.role, a.active, s.expires_at
     FROM admin_sessions s
     JOIN admin_accounts a ON a.id = s.admin_id
     WHERE s.token_hash = $1`,
    [tokenHash],
  );
  const row = result.rows[0];
  if (!row) return null;
  // Deactivated accounts and expired sessions are revoked lazily on use.
  if (!row.active || new Date(row.expires_at).getTime() <= Date.now()) {
    await db.query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
    return null;
  }
  return { id: String(row.id), name: String(row.name), email: String(row.email), role: row.role === "admin" ? "admin" : "operator" };
}

/** Requires an authenticated user with at least `required` role (default: admin). */
export function requireRole(user: AdminUser | null, required: AdminRole = "admin"): AdminUser {
  if (!user) throw new AdminError(401, "UNAUTHENTICATED", "Autenticação necessária.");
  if (ROLE_RANK[user.role] < ROLE_RANK[required]) throw new AdminError(403, "FORBIDDEN", "Acesso negado.");
  return user;
}

export async function invalidateSession(token: string | undefined, db: Db = pool()): Promise<void> {
  if (token) await db.query("DELETE FROM admin_sessions WHERE token_hash = $1", [sha256(token)]);
}

export async function revokeSessionsForAccount(accountId: string, db: Db = pool()): Promise<void> {
  await deleteAdminSessionsForAccount(accountId, db);
}
