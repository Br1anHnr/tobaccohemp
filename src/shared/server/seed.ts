import { products } from "@/data/products";
import type { Db } from "./database";

/** Threshold below which a product counts as low stock in the dashboard. */
export const LOW_STOCK_AT = 6;

export interface CatalogSeed {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
}

/** Tobacco Hemp catalog (general-use accessories), mapped to the admin wire contract. */
export const catalogProducts: CatalogSeed[] = products.map(product => ({
  id: product.id,
  sku: (product.slug ?? product.id).toUpperCase().replace(/[^A-Z0-9._-]/g, "-"),
  name: product.name,
  priceCents: Math.round(product.price * 100),
  stock: product.stock,
}));

/** Idempotently seed the catalog and its initial inventory quantities. */
export async function seedCatalog(db: Db, reorderPoint: number): Promise<void> {
  const now = new Date().toISOString();
  for (const product of catalogProducts) {
    await db.query(
      `INSERT INTO products (id, sku, name, price_cents, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [product.id, product.sku, product.name, product.priceCents, true, now],
    );
    await db.query(
      `INSERT INTO inventory (product_id, quantity, reorder_point, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id) DO NOTHING`,
      [product.id, product.stock, reorderPoint, now],
    );
  }
}
