import { cache } from "react";
import { pool } from "@/shared/server/database";
import { ensureSchema } from "@/shared/server/migrate";
import { products as staticProducts } from "@/data/products";
import { categories as staticCategories } from "@/data/categories";
import type { Product } from "@/types/product";
import type { Category } from "@/types/category";

interface ProductRow {
  id: string; slug: string; name: string; description: string; brand: string;
  category_slug: string | null; category_name: string | null; price_cents: number;
  is_new: boolean; is_featured: boolean; tags: unknown; variants: unknown; stock: number;
}

interface CategoryRow {
  slug: string; name: string; description: string; image: string; product_count: number;
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item)) : [];
}

function mapProduct(row: ProductRow, gallery: string[]): Product {
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

async function readFromDbUncached(): Promise<{ products: Product[]; categories: Category[] } | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensureSchema();
    const db = pool();

    const productsResult = await db.query(
      `SELECT p.id, p.slug, p.name, p.description, p.brand, p.category_slug,
              c.name AS category_name, p.price_cents, p.is_new, p.is_featured,
              p.tags, p.variants, COALESCE(i.quantity, 0)::int AS stock
       FROM products p
       LEFT JOIN categories c ON c.slug = p.category_slug
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.active = true AND p.archived_at IS NULL
       ORDER BY p.created_at, p.id`,
    );
    const rows = productsResult.rows as ProductRow[];

    const imagesResult = await db.query(
      `SELECT product_id, url FROM product_images
       WHERE product_id = ANY($1::text[])
       ORDER BY product_id, position, created_at`,
      [rows.map(row => row.id)],
    );
    const galleries = new Map<string, string[]>();
    for (const image of imagesResult.rows) {
      const list = galleries.get(String(image.product_id)) ?? [];
      list.push(String(image.url));
      galleries.set(String(image.product_id), list);
    }

    // Only categories with at least one visible product are surfaced in the
    // storefront navigation; empty categories stay out of the way.
    const categoriesResult = await db.query(
      `SELECT c.slug, c.name, c.description, c.image,
              (SELECT COUNT(*)::int FROM products p
               WHERE p.category_slug = c.slug AND p.active = true AND p.archived_at IS NULL) AS product_count
       FROM categories c
       ORDER BY c.name`,
    );

    return {
      products: rows.map(row => mapProduct(row, galleries.get(row.id) ?? [])),
      categories: (categoriesResult.rows as CategoryRow[])
        .filter(row => Number(row.product_count) > 0)
        .map(row => ({
          slug: row.slug,
          name: row.name,
          description: row.description,
          image: row.image,
        })),
    };
  } catch {
    // Fall back to the static catalog when the database is unavailable (e.g.
    // the production E2E build without DATABASE_URL).
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
