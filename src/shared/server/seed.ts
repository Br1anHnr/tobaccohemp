import { randomUUID } from "node:crypto";
import { products } from "@/data/products";
import { categories } from "@/data/categories";
import type { Db } from "./database";

/** Threshold below which a product counts as low stock in the dashboard. */
export const LOW_STOCK_AT = 6;

export interface CatalogSeed {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  brand: string;
  categorySlug: string;
  priceCents: number;
  stock: number;
  isNew: boolean;
  isFeatured: boolean;
  tags: string[];
  variants: string[];
  gallery: string[];
}

/** Tobacco Hemp catalog (general-use accessories), mapped to the database schema. */
export const catalogProducts: CatalogSeed[] = products.map(product => ({
  id: product.id,
  slug: product.slug,
  sku: (product.slug ?? product.id).toUpperCase().replace(/[^A-Z0-9._-]/g, "-"),
  name: product.name,
  description: product.description,
  brand: product.brand,
  categorySlug: product.categorySlug,
  priceCents: Math.round(product.price * 100),
  stock: product.stock,
  isNew: product.isNew,
  isFeatured: product.isFeatured,
  tags: product.tags,
  variants: product.variants ?? [],
  gallery: product.gallery?.length ? product.gallery : [product.image],
}));

/**
 * Idempotently seed categories, the catalog and its initial inventory/images.
 * Existing rows are preserved (INSERT ... ON CONFLICT DO NOTHING); only rows that
 * predate the catalog columns (empty slug) are backfilled, so admin edits survive.
 */
export async function seedCatalog(db: Db, reorderPoint: number): Promise<void> {
  const now = new Date().toISOString();

  for (const category of categories) {
    await db.query(
      `INSERT INTO categories (slug, name, description, image, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO NOTHING`,
      [category.slug, category.name, category.description, category.image, now],
    );
  }

  for (const product of catalogProducts) {
    await db.query(
      `INSERT INTO products
         (id, slug, sku, name, description, brand, category_slug, price_cents,
          active, is_new, is_featured, tags, variants, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
       ON CONFLICT (id) DO NOTHING`,
      [
        product.id, product.slug, product.sku, product.name, product.description,
        product.brand, product.categorySlug, product.priceCents, true,
        product.isNew, product.isFeatured, product.tags, product.variants, now,
      ],
    );

    // Backfill pre-existing rows created before the catalog columns existed.
    await db.query(
      `UPDATE products
       SET slug = $2, description = $3, brand = $4, category_slug = $5,
           is_new = $6, is_featured = $7, tags = $8, variants = $9
       WHERE id = $1 AND slug = ''`,
      [
        product.id, product.slug, product.description, product.brand,
        product.categorySlug, product.isNew, product.isFeatured,
        product.tags, product.variants,
      ],
    );

    await db.query(
      `INSERT INTO inventory (product_id, quantity, reorder_point, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id) DO NOTHING`,
      [product.id, product.stock, reorderPoint, now],
    );

    const seeded = await db.query(
      "SELECT COUNT(*)::int AS n FROM product_images WHERE product_id = $1",
      [product.id],
    );
    if (Number(seeded.rows[0].n) === 0) {
      for (let index = 0; index < product.gallery.length; index += 1) {
        await db.query(
          `INSERT INTO product_images (id, product_id, url, alt, position, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), product.id, product.gallery[index], product.name, index, now],
        );
      }
    }
  }
}
