import { Pool, type PoolClient } from "pg";
import { AdminError } from "./validation";

const globalForDb = globalThis as typeof globalThis & { adminPool?: Pool };

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
