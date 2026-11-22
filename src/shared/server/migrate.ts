import { pool } from "./database";
import { seedCatalog, LOW_STOCK_AT } from "./seed";
import { bootstrapAdminAccount } from "@/modules/auth";

interface Migration {
  id: string;
  sql: string;
}

// Versioning model: the runner keys on the full string `id` (stored in
// `schema_migrations`), never on a numeric prefix. Array order is the only
// application order. The three `003_*` ids below were authored independently
// by separate branches; they remain distinct strings (no primary-key
// collision) and are kept stable so already-applied records are preserved.
export const migrations: Migration[] = [
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
  {
    id: "003_admin_sessions",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions (admin_id);

      CREATE TABLE IF NOT EXISTS admin_login_attempts (
        id TEXT PRIMARY KEY,
        attempted_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS admin_login_attempts_at_idx ON admin_login_attempts (attempted_at);
    `,
  },
  {
    id: "003_orders_core",
    sql: `
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL,
        customer_account_id TEXT REFERENCES customer_accounts(id) ON DELETE SET NULL,
        customer_label TEXT NOT NULL DEFAULT 'Pedido demonstrativo',
        status TEXT NOT NULL,
        channel TEXT NOT NULL,
        payment_provider TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        provider_reference TEXT,
        checkout_url TEXT,
        subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
        shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
        discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
        total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
        currency TEXT NOT NULL DEFAULT 'BRL',
        is_demo BOOLEAN NOT NULL DEFAULT true,
        eligibility_status TEXT NOT NULL,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS orders_number_upper_idx ON orders (upper(order_number));
      CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS orders_customer_account_idx ON orders (customer_account_id);

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        product_name TEXT NOT NULL,
        category_slug TEXT NOT NULL,
        variant TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
        line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
        eligible BOOLEAN NOT NULL DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

      CREATE TABLE IF NOT EXISTS order_status_history (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        from_status TEXT,
        to_status TEXT NOT NULL,
        reason TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actor_id TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON order_status_history (order_id, created_at ASC);
    `,
  },
  {
    id: "004_admin_accounts",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS admin_accounts_email_lower_idx ON admin_accounts (lower(email));

      -- Sessions now reference a real account instead of a shared password. The
      -- legacy password_hash column (used to detect password rotation) is
      -- replaced by per-account revocation. Pre-account sessions are ephemeral
      -- and safe to clear before the foreign key is installed.
      DELETE FROM admin_sessions;
      ALTER TABLE admin_sessions DROP COLUMN IF EXISTS password_hash;
      ALTER TABLE admin_sessions ADD CONSTRAINT admin_sessions_account_fk
        FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE;
    `,
  },
  {
    id: "004_orders_consistency",
    sql: `
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_status TEXT NOT NULL DEFAULT 'none';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_reserved_at TIMESTAMPTZ;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_released_at TIMESTAMPTZ;
      CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx
        ON orders (idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS orders_pending_expires_idx
        ON orders (status, expires_at)
        WHERE status = 'pending_payment' AND expires_at IS NOT NULL;

      ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_quantity_non_negative_chk;
      ALTER TABLE inventory ADD CONSTRAINT inventory_quantity_non_negative_chk CHECK (quantity >= 0);
    `,
  },
  {
    id: "005_customer_addresses",
    sql: `
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
        label TEXT NOT NULL DEFAULT 'Principal',
        zip TEXT NOT NULL,
        street TEXT NOT NULL,
        number TEXT NOT NULL,
        complement TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS customer_addresses_account_idx
        ON customer_addresses (account_id, is_default DESC, updated_at DESC);
    `,
  },
];

migrations.push(
  {
    id: "005_asaas_sandbox",
    sql: `
      CREATE TABLE IF NOT EXISTS asaas_sandbox_attempts (
        order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
        external_reference TEXT NOT NULL UNIQUE,
        method TEXT NOT NULL CHECK (method IN ('pix','card')),
        state TEXT NOT NULL CHECK (state IN ('prepared','creating','uncertain','ready','review')),
        provider_id TEXT UNIQUE,
        payment_id TEXT UNIQUE,
        last_provider_status TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS asaas_sandbox_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        resource_id TEXT,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        result TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    id: "006_asaas_sandbox_diagnostics",
    sql: `
      ALTER TABLE asaas_sandbox_attempts ADD COLUMN IF NOT EXISTS last_error_code TEXT;
      ALTER TABLE asaas_sandbox_attempts ADD COLUMN IF NOT EXISTS last_error_status INTEGER;
      ALTER TABLE asaas_sandbox_attempts ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;
    `,
  },
);

let running: Promise<void> | undefined;

/** Apply pending migrations and seed the catalog exactly once per process. */
export function ensureSchema(): Promise<void> {
  running ??= run().catch(error => {
    running = undefined;
    throw error;
  });
  return running;
}

async function readAppliedMigrations(): Promise<Set<string>> {
  const db = pool();
  try {
    const applied = await db.query("SELECT id FROM schema_migrations");
    return new Set(applied.rows.map(row => String(row.id)));
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== "42P01") throw error;
    await db.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         id TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    return new Set();
  }
}

async function run(): Promise<void> {
  const db = pool();
  const done = await readAppliedMigrations();
  let appliedAny = false;

  for (const migration of migrations) {
    if (done.has(migration.id)) continue;
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
      await client.query("COMMIT");
      appliedAny = true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  if (!appliedAny) {
    const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@example.test").trim().toLowerCase();
    const statusResult = await db.query(
      `SELECT
         EXISTS(SELECT 1 FROM categories) AS has_categories,
         EXISTS(SELECT 1 FROM products) AS has_products,
         EXISTS(SELECT 1 FROM products WHERE slug = '') AS needs_backfill,
         EXISTS(SELECT 1 FROM admin_accounts WHERE lower(email) = lower($1)) AS has_admin`,
      [adminEmail],
    );
    const status = statusResult.rows[0] as {
      has_categories: boolean;
      has_products: boolean;
      needs_backfill: boolean;
      has_admin: boolean;
    };
    if (!status.has_categories || !status.has_products || status.needs_backfill) {
      await seedCatalog(db, LOW_STOCK_AT);
    }
    if (!status.has_admin) {
      await bootstrapAdminAccount(db);
    }
    return;
  }

  await seedCatalog(db, LOW_STOCK_AT);
  await bootstrapAdminAccount(db);
}
