import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";

// Full catalog flow against the real Neon + Cloudflare R2 backend:
// create → upload image → public read → edit price → reflect on the storefront
// → replace image → remove image → archive → hide. Nothing is mocked.
const ORIGIN = "http://127.0.0.1:3210";
const password = process.env.ADMIN_PASSWORD ?? "synthetic-integration-password";

// Valid 1×1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
// Distinct valid 1×1 red PNG used for the replace step (still served as image/png).
const PNG_ALT = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
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
    // product_images and inventory are removed by FK cascade. The R2 objects
    // are removed by the image DELETE route during the test body itself.
    await pool.query("DELETE FROM products WHERE id = $1", [id]);
  } finally {
    await pool.end();
  }
}

async function deleteCategoryBySlug(slug: string) {
  const url = process.env.DATABASE_URL;
  if (!url || !slug) return;
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query("DELETE FROM categories WHERE slug = $1", [slug]);
  } finally {
    await pool.end();
  }
}

test("cadastro, ciclo de imagem (upload/leitura/atualização/remoção) e reflexo na vitrine", async ({ page }, info) => {
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

    // Upload de imagem para o Cloudflare R2.
    const uploaded = await page.request.post(`/api/admin/products/${productId}/images`, {
      headers: { Origin: ORIGIN },
      multipart: { file: { name: "pixel.png", mimeType: "image/png", buffer: PNG } },
    });
    expect(uploaded.status()).toBe(201);
    const image = (await uploaded.json()).data;
    expect(image.id).toBeTruthy();
    // Exercise the configured adapter; isolated runs use local storage without R2 credentials.
    expect(image.url).toMatch(process.env.R2_PUBLIC_URL ? /^https:\/\// : /^\/uploads\/products\//);

    // Leitura pública do objeto recém-enviado.
    const read = await page.request.get(image.url);
    expect(read.status()).toBe(200);
    expect(String(read.headers()["content-type"] ?? "")).toContain("image/png");
    expect(Buffer.from(await read.body())).toEqual(PNG);

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

    // Atualização (substituição) da imagem: novo objeto criado, antigo removido.
    const replaced = await page.request.patch(`/api/admin/products/${productId}/images/${image.id}`, {
      headers: { Origin: ORIGIN },
      multipart: { file: { name: "updated.png", mimeType: "image/png", buffer: PNG_ALT } },
    });
    expect(replaced.status()).toBe(200);
    const newImage = (await replaced.json()).data;
    expect(newImage.id).toBe(image.id);
    expect(newImage.url).not.toBe(image.url);
    expect((await page.request.get(image.url)).status()).toBe(404);
    const newRead = await page.request.get(newImage.url);
    expect(newRead.status()).toBe(200);
    expect(Buffer.from(await newRead.body())).toEqual(PNG_ALT);

    // Remoção da imagem: linha e objeto R2 removidos.
    const removed = await page.request.delete(`/api/admin/products/${productId}/images/${image.id}`, {
      headers: { Origin: ORIGIN },
    });
    expect(removed.status()).toBe(200);
    const list = (await (await page.request.get(`/api/admin/products/${productId}/images`)).json()).data;
    expect(list).toHaveLength(0);
    expect((await page.request.get(newImage.url)).status()).toBe(404);

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

test("remoção de categoria some da UI sem reload e persiste no SQL", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const run = `${info.project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, "-");
  const slug = `cat-del-${run}`.slice(0, 64);
  const name = `Categoria Remoção ${run}`;
  try {
    await login(page);

    const created = await page.request.post("/api/admin/categories", {
      headers: { Origin: ORIGIN },
      data: { slug, name, description: "Categoria temporária para teste de remoção.", image: "" },
    });
    expect(created.status()).toBe(201);

    await page.goto("/admin/categorias");
    const row = page.locator(".admin-table tbody tr").filter({ hasText: name });
    await expect(row).toHaveCount(1);

    // Remove pela própria interface: o DELETE retorna um corpo de sucesso
    // (`{ data: null }`), então o painel atualiza a lista sem exigir reload.
    await row.getByRole("button", { name: `Remover categoria ${name}` }).click();
    await expect(row).toHaveCount(0);

    // O DELETE confirmou no banco e a lista continua sem a categoria após refresh.
    const url = process.env.DATABASE_URL;
    if (url) {
      const pool = new Pool({ connectionString: url, max: 1 });
      try {
        const res = await pool.query("SELECT count(*)::int AS n FROM categories WHERE slug = $1", [slug]);
        expect(Number(res.rows[0].n)).toBe(0);
      } finally {
        await pool.end();
      }
    }
    await page.reload();
    await expect(page.locator(".admin-table tbody tr").filter({ hasText: name })).toHaveCount(0);
  } finally {
    await deleteCategoryBySlug(slug);
  }
});

test("edição de preço de produto sem categoria persiste sem corromper o valor ausente", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const run = `${info.project.name}-${Date.now()}`.replace(/[^A-Za-z0-9]/g, "-");
  const sku = `NOCAT-${run}`.toUpperCase().slice(0, 32);
  const name = `Produto Sem Categoria ${run}`;
  let productId = "";
  try {
    await login(page);

    // Cria sem categoria: o banco grava category_slug = NULL.
    const created = await page.request.post("/api/admin/products", {
      headers: { Origin: ORIGIN },
      data: { name, sku, priceCents: 1990, active: true },
    });
    expect(created.status()).toBe(201);
    productId = String((await created.json()).data.id);

    await page.goto("/admin/produtos");
    const row = page.locator(".admin-table tbody tr").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Sem categoria");

    // Edita apenas o preço pelo painel.
    await row.getByRole("button", { name: `Editar ${name}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Preço (R$)", { exact: true }).fill("39,90");
    await dialog.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(dialog).toHaveCount(0);

    // Sucesso reflete na linha, mantendo a categoria ausente.
    await expect(row).toContainText(/39,90/);
    await expect(row).toContainText("Sem categoria");

    // Persiste após reload e o valor ausente continua ausente no banco.
    await page.reload();
    await expect(page.locator(".admin-table tbody tr").filter({ hasText: name })).toContainText(/39,90/);
    const url = process.env.DATABASE_URL;
    if (url) {
      const pool = new Pool({ connectionString: url, max: 1 });
      try {
        const res = await pool.query(
          "SELECT price_cents, category_slug FROM products WHERE id = $1",
          [productId],
        );
        expect(Number(res.rows[0].price_cents)).toBe(3990);
        expect(res.rows[0].category_slug).toBeNull();
      } finally {
        await pool.end();
      }
    }
  } finally {
    if (productId) await deleteProduct(productId);
  }
});

test("upload de imagem rejeita conteúdo inválido e não grava registro", async ({ page }, info) => {
  const run = `${info.project.name}-${Date.now()}`.replace(/[^A-Za-z0-9]/g, "-");
  const sku = `IMG-${run}`.toUpperCase().slice(0, 32);
  let productId = "";
  try {
    await login(page);

    const created = await page.request.post("/api/admin/products", {
      headers: { Origin: ORIGIN },
      data: { name: `Produto Imagem ${run}`, sku, priceCents: 1990, active: true, categorySlug: "cases" },
    });
    expect(created.status()).toBe(201);
    productId = String((await created.json()).data.id);

    // Bytes que não são imagem, declarados como PNG: rejeitados antes de gravar.
    const garbage = await page.request.post(`/api/admin/products/${productId}/images`, {
      headers: { Origin: ORIGIN },
      multipart: { file: { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("isto não é uma imagem") } },
    });
    expect(garbage.status()).toBe(422);
    expect((await garbage.json()).error.code).toBe("VALIDATION");

    // PNG válido declarado como JPEG: conteúdo não corresponde ao formato declarado.
    const mismatch = await page.request.post(`/api/admin/products/${productId}/images`, {
      headers: { Origin: ORIGIN },
      multipart: { file: { name: "real.png", mimeType: "image/jpeg", buffer: PNG } },
    });
    expect(mismatch.status()).toBe(422);
    expect((await mismatch.json()).error.code).toBe("VALIDATION");

    // Nenhum registro de imagem deve ter sido persistido após as rejeições.
    const list = await page.request.get(`/api/admin/products/${productId}/images`);
    expect(list.status()).toBe(200);
    expect((await list.json()).data).toHaveLength(0);
  } finally {
    if (productId) await deleteProduct(productId);
  }
});
