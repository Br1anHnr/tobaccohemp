import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { pool } from "@/shared/server/database";
import { ensureSchema } from "@/shared/server/migrate";
import { products as staticProducts } from "@/data/products";
import { categories as staticCategories } from "@/data/categories";
import type { Product } from "@/types/product";
import type { Category } from "@/types/category";

export const STOREFRONT_CATALOG_TAG = "storefront-catalog";

interface ProductRow {
  id: string; slug: string; name: string; description: string; brand: string;
  category_slug: string | null; category_name: string | null; price_cents: number;
  is_new: boolean; is_featured: boolean; tags: unknown; variants: unknown; stock: number;
  gallery: unknown;
}

interface CategoryRow {
  slug: string; name: string; description: string; image: string;
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item)) : [];
}

function mapProduct(row: ProductRow): Product {
  const gallery = asArray(row.gallery);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category_name ?? "Sem categoria",
    categorySlug: row.category_slug ?? "sem-categoria",
    price: Number(row.price_cents) / 100,
    image: gallery[0] ?? "",
    gallery,
    description: row.description,
    isNew: row.is_new === true,
    isFeatured: row.is_featured === true,
    stock: Number(row.stock),
    variants: asArray(row.variants),
    tags: asArray(row.tags),
  };
}

/**
 * Fetches the public storefront catalog (products, R2/local images, stock and
 * active categories) in a single parallel DB round-trip. Never reads cookies,
 * headers or customer session data.
 */
async function queryPublicCatalog(): Promise<{ products: Product[]; categories: Category[] }> {
  await ensureSchema();
  const db = pool();

  const [productsResult, categoriesResult] = await Promise.all([
    db.query(
      `SELECT p.id, p.slug, p.name, p.description, p.brand, p.category_slug,
              c.name AS category_name, p.price_cents, p.is_new, p.is_featured,
              p.tags, p.variants, COALESCE(i.quantity, 0)::int AS stock,
              COALESCE(img.gallery, '{}'::text[]) AS gallery
       FROM products p
       LEFT JOIN categories c ON c.slug = p.category_slug
       LEFT JOIN inventory i ON i.product_id = p.id
       LEFT JOIN (
         SELECT product_id, array_agg(url ORDER BY position, created_at) AS gallery
         FROM product_images
         GROUP BY product_id
       ) img ON img.product_id = p.id
       WHERE p.active = true AND p.archived_at IS NULL
       ORDER BY p.created_at, p.id`,
    ),
    // Only categories with at least one visible product are surfaced in the
    // storefront navigation; empty categories stay out of the way.
    db.query(
      `SELECT c.slug, c.name, c.description, c.image
       FROM categories c
       WHERE EXISTS (
         SELECT 1 FROM products p
         WHERE p.category_slug = c.slug AND p.active = true AND p.archived_at IS NULL
       )
       ORDER BY c.name`,
    ),
  ]);

  return {
    products: (productsResult.rows as ProductRow[]).map(mapProduct),
    categories: (categoriesResult.rows as CategoryRow[]).map(row => ({
      slug: row.slug,
      name: row.name,
      description: row.description,
      image: row.image,
    })),
  };
}

const getCachedPublicCatalog = unstable_cache(
  queryPublicCatalog,
  ["storefront-public-catalog-v1"],
  {
    tags: [STOREFRONT_CATALOG_TAG],
    revalidate: 60,
  },
);

/** Immediately invalidates the public catalog cache after admin/stock mutations. */
export function revalidateStorefrontCatalog(): void {
  try {
    revalidateTag(STOREFRONT_CATALOG_TAG, { expire: 0 });
  } catch {
    // Outside a Next.js request lifecycle (e.g. standalone scripts).
  }
}

async function readFromDbUncached(): Promise<{ products: Product[]; categories: Category[] } | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await getCachedPublicCatalog();
  } catch (error) {
    // A configured database that fails is a real incident, not a reason to
    // serve stale static data silently. Keep the static fallback for graceful
    // degradation (and for the DATABASE_URL-less E2E build above), but surface
    // the failure so it can be observed and alerted on.
    console.error("[storefront] falha ao ler o catálogo do banco; usando catálogo estático:", error);
    return null;
  }
}

export const getStorefrontProducts = cache(async (): Promise<Product[]> => {
  return (await readFromDb())?.products ?? staticProducts;
});

export const getStorefrontCategories = cache(async (): Promise<Category[]> => {
  return (await readFromDb())?.categories ?? staticCategories;
});

const readFromDb = cache(readFromDbUncached);
