import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";

// Full catalog flow against the real Neon backend: create → upload image →
// edit price → reflect on the storefront → archive → hide. Nothing is mocked.
const ORIGIN = "http://127.0.0.1:3210";
const password = process.env.ADMIN_PASSWORD ?? "synthetic-integration-password";

// Valid 1×1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function login(page: Page) {
  const response = await page.request.post("/api/admin/auth/login", {
    headers: { Origin: ORIGIN },
    data: { email: "admin@example.test", password },
  });
  expect(response.status()).toBe(200);
}

async function deleteProduct(id: string) {
  const url = process.env.DATABASE_URL;
  if (!url || !id) return;
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    // product_images and inventory are removed by FK cascade.
    await pool.query("DELETE FROM products WHERE id = $1", [id]);
  } finally {
    await pool.end();
  }
}

test("cadastro, edição de preço/imagem e reflexo na vitrine", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const run = `${info.project.name}-${Date.now()}`.replace(/[^A-Za-z0-9]/g, "-");
  const sku = `CAT-${run}`.toUpperCase().slice(0, 32);
  const name = `Produto Catálogo ${run}`;
  let productId = "";

  try {
    await login(page);

    // Cadastro de produto.
    const created = await page.request.post("/api/admin/products", {
      headers: { Origin: ORIGIN },
      data: { name, sku, priceCents: 1990, active: true, description: "Produto de teste do catálogo.", categorySlug: "cases" },
    });
    expect(created.status()).toBe(201);
    productId = (await created.json()).data.id;
    expect(productId).toBeTruthy();

    // Upload de imagem (múltiplas imagens são suportadas; validamos a primeira).
    const uploaded = await page.request.post(`/api/admin/products/${productId}/images`, {
      headers: { Origin: ORIGIN },
      multipart: { file: { name: "pixel.png", mimeType: "image/png", buffer: PNG } },
    });
    expect(uploaded.status()).toBe(201);
    const image = (await uploaded.json()).data;
    // Local (development) or R2 (Cloudflare) — both are valid outcomes.
    expect(image.url).toMatch(/^(\/uploads\/products\/|https:\/\/)/);

    // Edição de preço.
    const edited = await page.request.patch(`/api/admin/products/${productId}`, {
      headers: { Origin: ORIGIN },
      data: { priceCents: 2990 },
    });
    expect(edited.status()).toBe(200);

    // O catálogo administrativo reflete a imagem e o novo preço.
    const adminProducts = (await (await page.request.get("/api/admin/products")).json()).data;
    const stored = adminProducts.find((p: { id: string }) => p.id === productId);
    expect(stored.priceCents).toBe(2990);
    expect(stored.images.map((item: { url: string }) => item.url)).toContain(image.url);

    // A vitrine pública reflete o produto e o novo preço.
    await page.goto(`/loja?q=${encodeURIComponent(name)}`);
    const card = page.locator(".product-card").filter({ hasText: name });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("29,90");

    // Arquivar (soft delete) oculta o produto da vitrine.
    const archived = await page.request.delete(`/api/admin/products/${productId}`, {
      headers: { Origin: ORIGIN },
    });
    expect(archived.status()).toBe(200);
    await page.goto(`/loja?q=${encodeURIComponent(name)}`);
    await expect(page.locator(".product-card").filter({ hasText: name })).toHaveCount(0);
  } finally {
    if (productId) await deleteProduct(productId);
  }
});
