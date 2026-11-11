import { pool } from "./database";
import { seedCatalog, LOW_STOCK_AT } from "./seed";

interface Migration {
  id: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    id: "001_init",
    sql: `
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS customers_email_lower_idx ON customers (lower(email));

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        price_cents INTEGER NOT NULL,
        active BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS products_sku_lower_idx ON products (lower(sku));

      CREATE TABLE IF NOT EXISTS inventory (
        product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        reorder_point INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `,
  },
];

let running: Promise<void> | undefined;

/** Apply pending migrations and seed the catalog exactly once per process. */
export function ensureSchema(): Promise<void> {
  running ??= run().catch(error => {
    running = undefined;
    throw error;
  });
  return running;
}

async function run(): Promise<void> {
  const db = pool();
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const applied = await db.query("SELECT id FROM schema_migrations");
  const done = new Set(applied.rows.map(row => String(row.id)));

  for (const migration of migrations) {
    if (done.has(migration.id)) continue;
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  await seedCatalog(db, LOW_STOCK_AT);
}
