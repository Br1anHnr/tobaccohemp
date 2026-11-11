import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AdminUser } from "@/shared/contracts/admin";
import { AdminError, objectInput, textInput } from "@/shared/server/validation";

export const sessionCookie = "th_admin_session";
export const sessionSeconds = 30 * 60;
const admin: AdminUser = { id: "local-admin", name: "Administrador", email: "admin@example.test", role: "admin" };
interface AuthState {
  sessions: Map<string, { expires: number; passwordHash: string }>;
  attempts: number[];
}
const globalState = globalThis as typeof globalThis & { tobaccoHempAdminAuth?: AuthState };
const state = globalState.tobaccoHempAdminAuth ??= { sessions: new Map(), attempts: [] };
const hash = (value: string) => createHash("sha256").update(value).digest();

export function authenticate(value: unknown): { user: AdminUser; token: string } {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new AdminError(503, "NOT_CONFIGURED", "Configure ADMIN_PASSWORD no servidor.");
  const now = Date.now();
  state.attempts = state.attempts.filter(time => now - time < 60_000);
  if (state.attempts.length >= 5) throw new AdminError(429, "RATE_LIMIT", "Aguarde antes de tentar novamente.");
  state.attempts.push(now);
  const input = objectInput(value, ["email", "password"]);
  const email = textInput(input.email, 254).toLowerCase();
  // Do not trim passwords: leading/trailing spaces can be intentional.
  if (typeof input.password !== "string" || input.password.length > 1024) {
    throw new AdminError(422, "VALIDATION", "Dados inválidos.");
  }
  const validPassword = timingSafeEqual(hash(input.password), hash(password));
  if (!validPassword || email !== admin.email) throw new AdminError(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");
  for (const [token, session] of state.sessions) if (session.expires <= now) state.sessions.delete(token);
  if (state.sessions.size >= 100) state.sessions.delete(state.sessions.keys().next().value ?? "");
  const token = randomBytes(32).toString("hex");
  state.sessions.set(token, { expires: now + sessionSeconds * 1000, passwordHash: hash(password).toString("hex") });
  return { user: { ...admin }, token };
}

export function sessionUser(token: string | undefined): AdminUser | null {
  if (!token) return null;
  const session = state.sessions.get(token);
  const password = process.env.ADMIN_PASSWORD;
  if (!session) return null;
  if (!password || session.expires <= Date.now() || session.passwordHash !== hash(password).toString("hex")) {
    state.sessions.delete(token);
    return null;
  }
  return { ...admin };
}

export function authorize(user: AdminUser | null): void {
  if (!user) throw new AdminError(401, "UNAUTHENTICATED", "Autenticação necessária.");
  if (user.role !== "admin") throw new AdminError(403, "FORBIDDEN", "Acesso negado.");
}

export function invalidateSession(token: string | undefined): void {
  if (token) state.sessions.delete(token);
}
