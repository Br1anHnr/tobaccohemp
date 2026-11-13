import type { Category } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";
import { AdminError, duplicate, invalid, missing, objectInput, textInput, textInputAllowEmpty } from "@/shared/server/validation";

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function slugText(value: unknown): string {
  const slug = textInput(value, 80).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(slug)) invalid();
  return slug;
}

interface CategoryRow {
  slug: string; name: string; description: string; image: string;
  product_count: number; created_at: string;
}

export async function listCategories(db: Db = pool()): Promise<Category[]> {
  const result = await db.query(
    `SELECT c.slug, c.name, c.description, c.image, c.created_at,
            COUNT(p.id)::int AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_slug = c.slug AND p.archived_at IS NULL
     GROUP BY c.slug, c.name, c.description, c.image, c.created_at
     ORDER BY c.name`,
  );
  return (result.rows as CategoryRow[]).map(row => ({
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: row.image,
    productCount: Number(row.product_count),
    createdAt: toIso(row.created_at),
  }));
}

export async function saveCategory(value: unknown, slug?: string, db: Db = pool()): Promise<Category> {
  const input = objectInput(value, ["slug", "name", "description", "image"], slug !== undefined);
  const existingSlug = slug ?? (input.slug as string | undefined);
  if (!existingSlug) invalid();
  const normalized = slugText(existingSlug);
  const current = slug ? (await listCategories(db)).find(c => c.slug === slug) : undefined;
  if (slug !== undefined && !current) missing();

  const name = textInput(input.name, 120);
  const description = "description" in input ? textInputAllowEmpty(input.description, 500) : current?.description ?? "";
  const image = "image" in input ? textInputAllowEmpty(input.image, 500) : current?.image ?? "";

  const others = (await listCategories(db)).filter(c => c.slug !== slug);
  if (others.some(c => c.slug.toLowerCase() === normalized.toLowerCase())) duplicate();

  const createdAt = current?.createdAt ?? new Date().toISOString();
  await db.query(
    `INSERT INTO categories (slug, name, description, image, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       image = EXCLUDED.image`,
    [normalized, name, description, image, createdAt],
  );
  return {
    slug: normalized, name, description, image,
    productCount: current?.productCount ?? 0, createdAt,
  };
}

/** Categories are only deletable while empty; otherwise history would break. */
export async function deleteCategory(slug: string, db: Db = pool()): Promise<void> {
  const categories = await listCategories(db);
  const current = categories.find(c => c.slug === slug);
  if (!current) missing();
  if (current.productCount > 0) {
    throw new AdminError(409, "IN_USE", "Categoria possui produtos vinculados.");
  }
  await db.query("DELETE FROM categories WHERE slug = $1", [slug]);
}
