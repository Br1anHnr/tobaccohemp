import { randomUUID } from "node:crypto";
import type { ProductImage } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";
import { AdminError, integerInput, invalid, missing, objectInput } from "@/shared/server/validation";
import { getImageStorage } from "./image-storage";
import { getProduct } from "./products";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/** Magic-byte signatures for the supported image formats. */
const SIGNATURES: ReadonlyArray<{ mime: string; matches: (body: Buffer) => boolean }> = [
  {
    mime: "image/jpeg",
    matches: body => body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff,
  },
  {
    mime: "image/png",
    matches: body =>
      body.length >= 8 &&
      body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: "image/webp",
    matches: body =>
      body.length >= 12 &&
      body.subarray(0, 4).toString("ascii") === "RIFF" &&
      body.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

/** Detect the effective image format from the file's magic bytes, or null. */
export function detectImageFormat(body: Buffer): string | null {
  for (const signature of SIGNATURES) {
    if (signature.matches(body)) return signature.mime;
  }
  return null;
}

interface PreparedFile {
  fileName: string;
  body: Buffer;
  contentType: string;
}

async function prepareFile(file: File): Promise<PreparedFile> {
  const ext = ALLOWED.get(file.type);
  if (!ext) throw new AdminError(422, "VALIDATION", "Envie uma imagem JPEG, PNG ou WebP.");
  if (file.size > MAX_BYTES) throw new AdminError(422, "VALIDATION", "A imagem deve ter até 5 MB.");
  const body = Buffer.from(await file.arrayBuffer());
  // Validate the effective content, not just the declared MIME type, so bytes
  // that do not belong to the declared format are rejected before any write.
  const detected = detectImageFormat(body);
  if (!detected) {
    throw new AdminError(422, "VALIDATION", "O conteúdo enviado não é uma imagem JPEG, PNG ou WebP válida.");
  }
  if (detected !== file.type) {
    throw new AdminError(422, "VALIDATION", "O conteúdo da imagem não corresponde ao formato declarado.");
  }
  return {
    fileName: `${randomUUID()}.${ext}`,
    body,
    contentType: file.type,
  };
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
  const prepared = await prepareFile(file);
  const url = await getImageStorage().save(productId, prepared.fileName, prepared.body, prepared.contentType);
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
  await getImageStorage().remove(String(result.rows[0].url));
}

export async function replaceImage(productId: string, imageId: string, file: File, db: Db = pool()): Promise<ProductImage> {
  await assertProduct(productId, db);
  const current = await db.query(
    "SELECT url FROM product_images WHERE id = $1 AND product_id = $2",
    [imageId, productId],
  );
  if (!current.rows.length) missing();
  const prepared = await prepareFile(file);
  const url = await getImageStorage().save(productId, prepared.fileName, prepared.body, prepared.contentType);
  await db.query("UPDATE product_images SET url = $1 WHERE id = $2", [url, imageId]);
  await getImageStorage().remove(String(current.rows[0].url));
  const images = await listImages(productId, db);
  const image = images.find(item => item.id === imageId);
  if (!image) missing();
  return image;
}
