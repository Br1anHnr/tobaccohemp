import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AdminError } from "@/shared/server/validation";

/**
 * Storage de imagens. Abstrai onde os arquivos são persistidos para que o
 * catálogo nunca dependa do destino físico.
 *
 * - `r2`: Cloudflare R2 (S3-compatible) — destino de produção. Ativado quando
 *   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` e
 *   `R2_PUBLIC_URL` estão configurados.
 * - `local`: disco em `public/uploads/` — usado apenas em desenvolvimento como
 *   fallback, para permitir upload sem conta externa.
 */
export interface ImageStorage {
  readonly kind: "local" | "r2";
  save(productId: string, fileName: string, body: Buffer, contentType: string): Promise<string>;
  remove(url: string): Promise<void>;
}

class LocalImageStorage implements ImageStorage {
  readonly kind = "local";

  async save(productId: string, fileName: string, body: Buffer): Promise<string> {
    const key = `uploads/products/${productId}/${fileName}`;
    const filePath = path.join(process.cwd(), "public", key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return `/${key}`;
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith("/uploads/")) return;
    try {
      await unlink(path.join(process.cwd(), "public", url.replace(/^\//, "")));
    } catch {
      /* The file may already be gone; the database row is what matters. */
    }
  }
}

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

class R2ImageStorage implements ImageStorage {
  readonly kind = "r2";
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: R2Config) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl.replace(/\/+$/, "");
  }

  async save(productId: string, fileName: string, body: Buffer, contentType: string): Promise<string> {
    const key = `products/${productId}/${fileName}`;
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return `${this.publicUrl}/${key}`;
  }

  async remove(url: string): Promise<void> {
    const prefix = `${this.publicUrl}/`;
    if (!url.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

function resolveImageStorage(): ImageStorage {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL) {
    return new R2ImageStorage({
      accountId: R2_ACCOUNT_ID,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      bucket: R2_BUCKET,
      publicUrl: R2_PUBLIC_URL,
    });
  }
  if (process.env.VERCEL || !["development", "test"].includes(process.env.NODE_ENV ?? "")) {
    throw new AdminError(503, "STORAGE_NOT_CONFIGURED", "Configure storage R2 persistente completo para gerenciar imagens.");
  }
  return new LocalImageStorage();
}

let storage: ImageStorage | undefined;

/** Resolve the configured storage once per process. */
export function getImageStorage(): ImageStorage {
  storage ??= resolveImageStorage();
  return storage;
}
