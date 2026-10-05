import { chromium } from "@playwright/test";

const browser = await chromium.launch();
try {
  for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    await page.goto("http://127.0.0.1:3000/produto/case-compact-preto");
    await page.getByRole("button", { name: "Sim, tenho 18+" }).click();
    await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) { image.loading = "eager"; await image.decode(); } });
    await page.screenshot({ path: `artifacts/product-${name}.png`, fullPage: true });
    await page.getByRole("button", { name: "Adicionar Case Compact Preto ao carrinho" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Finalizar pedido" }).click();
    await page.screenshot({ path: `artifacts/checkout-${name}.png`, fullPage: true });
    await page.close();
  }
} finally {
  await browser.close();
}
