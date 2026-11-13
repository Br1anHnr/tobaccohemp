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
  {
    id: "002_customer_auth",
    sql: `
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_email_lower_idx ON customer_accounts (lower(email));

      CREATE TABLE IF NOT EXISTS customer_sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS customer_sessions_account_idx ON customer_sessions (account_id);

      CREATE TABLE IF NOT EXISTS customer_password_resets (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS customer_password_resets_account_idx ON customer_password_resets (account_id);
    `,
  },
  {
    id: "003_catalog",
    sql: `
      ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'Seleção da loja';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS category_slug TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS variants TEXT[] NOT NULL DEFAULT '{}';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
      CREATE UNIQUE INDEX IF NOT EXISTS products_slug_lower_idx ON products (lower(slug)) WHERE slug <> '';

      CREATE TABLE IF NOT EXISTS categories (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        image TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS product_images (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        alt TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images (product_id, position);
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
