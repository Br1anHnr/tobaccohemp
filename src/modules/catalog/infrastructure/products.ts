import { randomUUID } from "node:crypto";
import type { Product, ProductImage } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";
import { duplicate, invalid, missing } from "@/shared/server/validation";
import { productInput } from "../domain/product-input";

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item)) : [];
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || `produto-${randomUUID().slice(0, 8)}`;
}

interface ProductRow {
  id: string; slug: string; sku: string; name: string; description: string; brand: string;
  category_slug: string | null; category_name: string | null; price_cents: number; active: boolean;
  archived_at: string | null; is_new: boolean; is_featured: boolean; tags: unknown; variants: unknown;
  created_at: string; updated_at: string | null;
}

function mapProduct(row: ProductRow, images: ProductImage[]): Product {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    description: row.description,
    brand: row.brand,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    priceCents: Number(row.price_cents),
    active: row.active === true,
    archived: row.archived_at !== null,
    isNew: row.is_new === true,
    isFeatured: row.is_featured === true,
    tags: asArray(row.tags),
    variants: asArray(row.variants),
    images,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at ?? row.created_at),
  };
}

async function imagesByProduct(db: Db, productIds: string[]): Promise<Map<string, ProductImage[]>> {
  const map = new Map<string, ProductImage[]>();
  if (!productIds.length) return map;
  const result = await db.query(
    `SELECT id, product_id, url, alt, position FROM product_images
     WHERE product_id = ANY($1::text[]) ORDER BY position, created_at`,
    [productIds],
  );
  for (const row of result.rows) {
    const list = map.get(String(row.product_id)) ?? [];
    list.push({ id: String(row.id), url: String(row.url), alt: String(row.alt), position: Number(row.position) });
    map.set(String(row.product_id), list);
  }
  return map;
}

export async function listProducts(db: Db = pool()): Promise<Product[]> {
  const result = await db.query(
    `SELECT p.id, p.slug, p.sku, p.name, p.description, p.brand,
            p.category_slug, c.name AS category_name, p.price_cents, p.active,
            p.archived_at, p.is_new, p.is_featured, p.tags, p.variants,
            p.created_at, p.updated_at
     FROM products p
     LEFT JOIN categories c ON c.slug = p.category_slug
     ORDER BY p.created_at, p.id`,
  );
  const rows = result.rows as ProductRow[];
  const images = await imagesByProduct(db, rows.map(row => row.id));
  return rows.map(row => mapProduct(row, images.get(row.id) ?? []));
}

export async function getProduct(id: string, db: Db = pool()): Promise<Product | undefined> {
  const result = await db.query(
    `SELECT p.id, p.slug, p.sku, p.name, p.description, p.brand,
            p.category_slug, c.name AS category_name, p.price_cents, p.active,
            p.archived_at, p.is_new, p.is_featured, p.tags, p.variants,
            p.created_at, p.updated_at
     FROM products p
     LEFT JOIN categories c ON c.slug = p.category_slug
     WHERE p.id = $1`,
    [id],
  );
  const row = result.rows[0] as ProductRow | undefined;
  if (!row) return undefined;
  const images = await imagesByProduct(db, [row.id]);
  return mapProduct(row, images.get(row.id) ?? []);
}

export async function saveProduct(value: unknown, id?: string, db: Db = pool()): Promise<Product> {
  const input = productInput(value, id !== undefined);
  const rows = await listProducts(db);
  const existing = id === undefined ? undefined : rows.find(item => item.id === id);
  if (id !== undefined && !existing) missing();

  const name = input.name ?? existing?.name ?? "";
  const sku = (input.sku ?? existing?.sku ?? "").toUpperCase();
  const slug = input.slug ?? existing?.slug ?? slugify(name);

  const duplicateSku = rows.some(item => item.id !== id && item.sku.toUpperCase() === sku);
  if (duplicateSku) duplicate();
  if (slug) {
    const duplicateSlug = rows.some(item => item.id !== id && item.slug.toLowerCase() === slug.toLowerCase());
    if (duplicateSlug) duplicate();
  }

  const categorySlug = input.categorySlug !== undefined
    ? input.categorySlug
    : existing?.categorySlug ?? null;
  if (categorySlug) {
    const category = await db.query("SELECT slug FROM categories WHERE slug = $1", [categorySlug]);
    if (!category.rows.length) invalid();
  }

  const product: Product = {
    id: existing?.id ?? randomUUID(),
    slug,
    sku,
    name,
    description: input.description ?? existing?.description ?? "",
    brand: input.brand ?? existing?.brand ?? "Seleção da loja",
    categorySlug,
    categoryName: categorySlug ? (await categoryName(db, categorySlug)) : null,
    priceCents: input.priceCents ?? existing?.priceCents ?? 0,
    active: input.active ?? existing?.active ?? true,
    archived: input.archived ?? existing?.archived ?? false,
    isNew: input.isNew ?? existing?.isNew ?? false,
    isFeatured: input.isFeatured ?? existing?.isFeatured ?? false,
    tags: input.tags ?? existing?.tags ?? [],
    variants: input.variants ?? existing?.variants ?? [],
    images: existing?.images ?? [],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.query(
    `INSERT INTO products
       (id, slug, sku, name, description, brand, category_slug, price_cents,
        active, archived_at, is_new, is_featured, tags, variants, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (id) DO UPDATE SET
       slug = EXCLUDED.slug,
       sku = EXCLUDED.sku,
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       brand = EXCLUDED.brand,
       category_slug = EXCLUDED.category_slug,
       price_cents = EXCLUDED.price_cents,
       active = EXCLUDED.active,
       archived_at = EXCLUDED.archived_at,
       is_new = EXCLUDED.is_new,
       is_featured = EXCLUDED.is_featured,
       tags = EXCLUDED.tags,
       variants = EXCLUDED.variants,
       updated_at = EXCLUDED.updated_at`,
    [
      product.id, product.slug, product.sku, product.name, product.description,
      product.brand, product.categorySlug, product.priceCents, product.active,
      product.archived ? product.updatedAt : null, product.isNew, product.isFeatured,
      product.tags, product.variants, product.createdAt, product.updatedAt,
    ],
  );

  return { ...product, images: product.images };
}

async function categoryName(db: Db, slug: string): Promise<string> {
  const result = await db.query("SELECT name FROM categories WHERE slug = $1", [slug]);
  return result.rows[0] ? String(result.rows[0].name) : slug;
}
