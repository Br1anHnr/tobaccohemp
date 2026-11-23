import { Pool, type PoolClient } from "pg";
import { AdminError } from "./validation";

const globalForDb = globalThis as typeof globalThis & {
  adminPool?: Pool;
  sandboxPool?: Pool;
  sandboxPoolUrl?: string;
};

/** A `Pool` or a transaction `PoolClient`: both expose a compatible `query`. */
export type Db = Pool | PoolClient;

export function pool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new AdminError(503, "NOT_CONFIGURED", "Configure DATABASE_URL para conectar ao PostgreSQL.");
  if (!globalForDb.adminPool) {
    globalForDb.adminPool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForDb.adminPool;
}

function normalizeDbIdentity(connectionString: string): string {
  const trimmed = connectionString.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (!["postgresql:", "postgres:"].includes(parsed.protocol) || !parsed.hostname || parsed.pathname.length <= 1) return "";
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "").replace(/-pooler(?=\.)/, "");
    const port = parsed.port || "5432";
    const dbPath = decodeURIComponent(parsed.pathname).replace(/\/+$/, "").toLowerCase();
    return `${host}:${port}${dbPath}`;
  } catch {
    return "";
  }
}

export function hasIsolatedSandboxDatabase(): boolean {
  const sandboxUrl = process.env.ASAAS_SANDBOX_DATABASE_URL?.trim() ?? "";
  const primaryUrl = process.env.DATABASE_URL?.trim() ?? "";
  const sandbox = normalizeDbIdentity(sandboxUrl);
  const primary = normalizeDbIdentity(primaryUrl);
  return Boolean(sandbox && primary && sandbox !== primary);
}

/** Dedicated PostgreSQL pool for isolated Asaas Sandbox tests; never shares the commercial production DB. */
export function sandboxPool(): Pool {
  const sandboxUrl = process.env.ASAAS_SANDBOX_DATABASE_URL?.trim() ?? "";
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production") {
    if (!hasIsolatedSandboxDatabase()) {
      throw new AdminError(
        503,
        "ASAAS_SANDBOX_DB_NOT_ISOLATED",
        "Banco isolado do Asaas Sandbox não configurado.",
      );
    }
  }
  if (sandboxUrl) {
    if (!globalForDb.sandboxPool || globalForDb.sandboxPoolUrl !== sandboxUrl) {
      globalForDb.sandboxPool = new Pool({
        connectionString: sandboxUrl,
        max: 10,
        connectionTimeoutMillis: 10_000,
      });
      globalForDb.sandboxPoolUrl = sandboxUrl;
    }
    return globalForDb.sandboxPool;
  }
  return pool();
}

export async function closeSandboxPool(): Promise<void> {
  const current = globalForDb.sandboxPool;
  globalForDb.sandboxPool = undefined;
  globalForDb.sandboxPoolUrl = undefined;
  if (current) await current.end().catch(() => {});
}
