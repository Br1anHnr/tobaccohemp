import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { AdminUser } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";
import { AdminError, objectInput, textInput } from "@/shared/server/validation";

export const sessionCookie = "th_admin_session";
export const sessionSeconds = 30 * 60;

const admin: AdminUser = { id: "local-admin", name: "Administrador", email: "admin@example.test", role: "admin" };

const ATTEMPT_WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const MAX_SESSIONS = 100;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
// Buffer form used by timingSafeEqual so the credential comparison is constant-time.
const digest = (value: string) => createHash("sha256").update(value).digest();

function adminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new AdminError(503, "NOT_CONFIGURED", "Configure ADMIN_PASSWORD no servidor.");
  return password;
}

/**
 * Persistent login throttling. Sessions and attempts live in PostgreSQL so the
 * admin backend behaves correctly on serverless deployments (Vercel), where an
 * in-memory Map would not survive cold starts or scale across instances.
 */
async function throttle(db: Db): Promise<void> {
  const now = Date.now();
  await db.query("DELETE FROM admin_login_attempts WHERE attempted_at < $1", [new Date(now - ATTEMPT_WINDOW_MS).toISOString()]);
  const result = await db.query("SELECT count(*) AS n FROM admin_login_attempts");
  if (Number(result.rows[0]?.n ?? 0) >= MAX_ATTEMPTS) {
    throw new AdminError(429, "RATE_LIMIT", "Aguarde antes de tentar novamente.");
  }
  await db.query("INSERT INTO admin_login_attempts (id, attempted_at) VALUES ($1, $2)", [randomUUID(), new Date(now).toISOString()]);
}

export async function authenticate(value: unknown, db: Db = pool()): Promise<{ user: AdminUser; token: string }> {
  const password = adminPassword();
  await throttle(db);

  const input = objectInput(value, ["email", "password"]);
  const email = textInput(input.email, 254).toLowerCase();
  // Do not trim passwords: leading/trailing spaces can be intentional.
  if (typeof input.password !== "string" || input.password.length > 1024) {
    throw new AdminError(422, "VALIDATION", "Dados inválidos.");
  }
  const validPassword = timingSafeEqual(digest(input.password), digest(password));
  if (!validPassword || email !== admin.email) throw new AdminError(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");

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
  await db.query(
    `INSERT INTO admin_sessions (token_hash, admin_id, password_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [sha256(token), admin.id, sha256(password), new Date(Date.now() + sessionSeconds * 1000).toISOString(), new Date().toISOString()],
  );
  return { user: { ...admin }, token };
}

export async function sessionUser(token: string | undefined, db: Db = pool()): Promise<AdminUser | null> {
  if (!token) return null;
  const tokenHash = sha256(token);
  const result = await db.query("SELECT password_hash, expires_at FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
  const row = result.rows[0];
  const password = process.env.ADMIN_PASSWORD;
  if (!row) return null;
  // A password rotation invalidates every outstanding session immediately.
  if (!password || new Date(row.expires_at).getTime() <= Date.now() || String(row.password_hash) !== sha256(password)) {
    await db.query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
    return null;
  }
  return { ...admin };
}

export function authorize(user: AdminUser | null): void {
  if (!user) throw new AdminError(401, "UNAUTHENTICATED", "Autenticação necessária.");
  if (user.role !== "admin") throw new AdminError(403, "FORBIDDEN", "Acesso negado.");
}

export async function invalidateSession(token: string | undefined, db: Db = pool()): Promise<void> {
  if (token) await db.query("DELETE FROM admin_sessions WHERE token_hash = $1", [sha256(token)]);
}
