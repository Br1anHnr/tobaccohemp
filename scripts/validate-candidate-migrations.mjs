import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

// Explicitly restricted to this task's disposable database, never shared environments.
const url = new URL(process.env.DATABASE_URL ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55439");
assert.equal(url.pathname, "/tobacco_candidate");
const pool = new Pool({ connectionString: url.toString(), max: 1 });
const candidate = readFileSync("src/shared/server/migrate.ts", "utf8");
const source = (ref) => execFileSync("git", ["show", `${ref}:src/shared/server/migrate.ts`], { encoding: "utf8" });
const migrations = (text) => [...text.matchAll(/id: "([^"]+)",\s+sql: `([\s\S]*?)`/g)]
  .map((match) => ({ id: match[1], sql: match[2] }));
async function apply(client, text) {
  let count = 0;
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  for (const migration of migrations(text)) {
    if ((await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [migration.id])).rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations(id) VALUES ($1)", [migration.id]);
      await client.query("COMMIT");
      count++;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  return count;
}
try {
  for (const [name, ref] of [["base", "3aa1055"], ["admin", "2831ce3"], ["orders", "80ee25c"], ["empty", null]]) {
    const client = await pool.connect();
    try {
      const schema = `candidate_${name}_${Date.now()}`;
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      if (ref) {
        await apply(client, source(ref));
        await client.query("INSERT INTO products(id,sku,name,price_cents,active,created_at) VALUES ('preserved','PRESERVED','Case de teste',100,true,now())");
        await client.query("INSERT INTO inventory(product_id,quantity,reorder_point,updated_at) VALUES ('preserved',3,1,now())");
      }
      const added = await apply(client, candidate);
      assert.equal(added, name === "empty" ? 7 : name === "base" ? 2 : 1);
      assert.equal(await apply(client, candidate), 0);
      assert.equal((await client.query("SELECT id FROM schema_migrations")).rowCount, 7);
      if (ref) assert.equal((await client.query("SELECT quantity FROM inventory WHERE product_id='preserved'")).rows[0].quantity, 3);
      const fk = await client.query("SELECT 1 FROM pg_constraint WHERE conname='admin_sessions_account_fk' AND conrelid='admin_sessions'::regclass");
      assert.equal(fk.rowCount, 1);
      console.log(`PASS ${name}: ${added} pending migrations, 7 stable ids, repeat applies 0, stock preserved, session FK present (${schema})`);
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
