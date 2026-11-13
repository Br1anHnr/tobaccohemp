import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductImage } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";
import { AdminError, integerInput, invalid, missing, objectInput } from "@/shared/server/validation";
import { getProduct } from "./products";

/**
 * Image storage decision (free): files are written to local disk under
 * `public/uploads/products/<productId>/` and only their URLs are stored in
 * PostgreSQL — never binary blobs. This keeps the PRD requirement (object
 * storage, not Postgres binaries) while requiring no external account and
 * working fully offline for local validation. The write path is isolated in
 * `writeImageFile`/`removeImageFile` so it can be swapped for Cloudflare R2
 * (free 10 GB tier, S3-compatible, no egress fees) or Cloudinary later via the
 * same interface, without touching the catalog logic.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function uploadsDir(productId: string): string {
  return path.join(process.cwd(), "public", "uploads", "products", productId);
}

async function writeImageFile(productId: string, file: File): Promise<string> {
  const ext = ALLOWED.get(file.type);
  if (!ext) throw new AdminError(422, "VALIDATION", "Envie uma imagem JPEG, PNG ou WebP.");
  if (file.size > MAX_BYTES) throw new AdminError(422, "VALIDATION", "A imagem deve ter até 5 MB.");
  const dir = uploadsDir(productId);
  await mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
  return `/uploads/products/${productId}/${fileName}`;
}

export async function removeImageFile(url: string): Promise<void> {
  if (!url.startsWith("/uploads/")) return;
  try {
    await unlink(path.join(process.cwd(), "public", url.replace(/^\//, "")));
  } catch {
    /* The file may already be gone; the DB row is what matters. */
  }
}

function mapImage(row: Record<string, unknown>): ProductImage {
  return {
    id: String(row.id),
    url: String(row.url),
    alt: String(row.alt),
    position: Number(row.position),
  };
}

async function assertProduct(productId: string, db: Db): Promise<void> {
  if (!(await getProduct(productId, db))) missing();
}

export async function listImages(productId: string, db: Db = pool()): Promise<ProductImage[]> {
  await assertProduct(productId, db);
  const result = await db.query(
    "SELECT id, url, alt, position FROM product_images WHERE product_id = $1 ORDER BY position, created_at",
    [productId],
  );
  return result.rows.map(mapImage);
}

export async function addImage(productId: string, file: File, alt: string, db: Db = pool()): Promise<ProductImage> {
  await assertProduct(productId, db);
  const url = await writeImageFile(productId, file);
  const images = await listImages(productId, db);
  const position = images.reduce((max, image) => Math.max(max, image.position), -1) + 1;
  const id = randomUUID();
  await db.query(
    `INSERT INTO product_images (id, product_id, url, alt, position, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, productId, url, alt, position, new Date().toISOString()],
  );
  return { id, url, alt, position };
}

/** Reorders images by an explicit list of `{ id, position }` pairs. */
export async function reorderImages(productId: string, value: unknown, db: Db = pool()): Promise<ProductImage[]> {
  const input = objectInput(value, ["images"]);
  if (!Array.isArray(input.images)) invalid();
  const entries = input.images.map(item => {
    const entry = objectInput(item, ["id", "position"]);
    return { id: String(entry.id), position: integerInput(entry.position) };
  });
  const existing = await listImages(productId, db);
  const existingIds = new Set(existing.map(image => image.id));
  if (entries.length !== existing.length || entries.some(entry => !existingIds.has(entry.id))) invalid();
  const positions = entries.map(entry => entry.position);
  if (new Set(positions).size !== positions.length) invalid();

  for (const entry of entries) {
    await db.query("UPDATE product_images SET position = $1 WHERE id = $2 AND product_id = $3", [
      entry.position, entry.id, productId,
    ]);
  }
  return listImages(productId, db);
}

export async function deleteImage(productId: string, imageId: string, db: Db = pool()): Promise<void> {
  await assertProduct(productId, db);
  const result = await db.query(
    "DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING url",
    [imageId, productId],
  );
  if (!result.rows.length) missing();
  await removeImageFile(String(result.rows[0].url));
}

export async function replaceImage(productId: string, imageId: string, file: File, db: Db = pool()): Promise<ProductImage> {
  await assertProduct(productId, db);
  const current = await db.query(
    "SELECT url FROM product_images WHERE id = $1 AND product_id = $2",
    [imageId, productId],
  );
  if (!current.rows.length) missing();
  const url = await writeImageFile(productId, file);
  await db.query("UPDATE product_images SET url = $1 WHERE id = $2", [url, imageId]);
  await removeImageFile(String(current.rows[0].url));
  const images = await listImages(productId, db);
  const image = images.find(item => item.id === imageId);
  if (!image) missing();
  return image;
}
