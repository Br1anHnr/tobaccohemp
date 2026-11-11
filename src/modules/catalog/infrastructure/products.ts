import { randomUUID } from "node:crypto";
import type { Product } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";
import { duplicate, missing } from "@/shared/server/validation";
import { productInput } from "../domain/product-input";

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function listProducts(db: Db = pool()): Promise<Product[]> {
  const result = await db.query(
    "SELECT id, sku, name, price_cents, active, created_at FROM products ORDER BY created_at, id",
  );
  return result.rows.map(row => ({
    id: String(row.id), sku: String(row.sku), name: String(row.name),
    priceCents: Number(row.price_cents), active: row.active === true, createdAt: toIso(row.created_at),
  }));
}

export async function saveProduct(value: unknown, id?: string, db: Db = pool()): Promise<Product> {
  const input = productInput(value, id !== undefined);
  const rows = await listProducts(db);
  const existing = id === undefined ? undefined : rows.find(item => item.id === id);
  if (id !== undefined && !existing) missing();
  const product: Product = {
    id: existing?.id ?? randomUUID(), sku: input.sku ?? existing?.sku ?? "", name: input.name ?? existing?.name ?? "",
    priceCents: input.priceCents ?? existing?.priceCents ?? 0, active: input.active ?? existing?.active ?? true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  if (rows.some(item => item.id !== product.id && item.sku.toUpperCase() === product.sku)) duplicate();
  await db.query(
    `INSERT INTO products (id, sku, name, price_cents, active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       sku = EXCLUDED.sku, name = EXCLUDED.name,
       price_cents = EXCLUDED.price_cents, active = EXCLUDED.active`,
    [product.id, product.sku, product.name, product.priceCents, product.active, product.createdAt],
  );
  return product;
}
