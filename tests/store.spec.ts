import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function enter(page: Page, path = "/") {
  await page.goto(path);
  await page.getByRole("button", { name: "Sim, tenho 18+" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("header logo is not cropped and desktop navigation is readable", async ({
  page,
}, testInfo) => {
  await enter(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const scroll of [0, 500]) {
      await page.evaluate((y) => window.scrollTo(0, y), scroll);
      await page.waitForTimeout(100);
      const fits = await page
        .locator("header .logo-window")
        .evaluate((element) => {
          const window = element.getBoundingClientRect();
          const image = element.querySelector("img")!.getBoundingClientRect();
          // Actual artwork bounds within the unaltered official 1080 × 1350 PNG.
          return (
            image.left + (272 / 1080) * image.width >= window.left &&
            image.left + (787 / 1080) * image.width <= window.right &&
            image.top + (470 / 1350) * image.height >= window.top &&
            image.top + (868 / 1350) * image.height <= window.bottom
          );
        });
      expect(fits).toBeTruthy();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
    }
  }
  expect(
    await page
      .locator(".desktop-nav a")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(12);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page
    .locator("header")
    .screenshot({ path: `artifacts/header-${testInfo.project.name}.png` });
});

test("age gate persists, exit blocks entry, official logo is unchanged", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Até a próxima." }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Sim, tenho 18+" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "SEU ESTILO.", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("header img")).toHaveAttribute(
    "src",
    /tobacco-hemp-logo/,
  );
});

test("routes, images and responsive layout have no unexpected errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await enter(page);
  const routes = [
    "/",
    "/loja",
    "/categorias",
    "/categoria/cases",
    "/produto/case-compact-preto",
    "/carrinho",
    "/checkout",
    "/sobre",
    "/contato",
    "/favoritos",
    "/ajuda/privacidade",
    "/pedido-confirmado",
  ];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
    await page.locator("main img").evaluateAll(async (images) => {
      await Promise.all(
        images.map(async (node) => {
          const image = node as HTMLImageElement;
          image.loading = "eager";
          await image.decode();
        }),
      );
    });
  }
  await page.goto("/");
  for (
    let y = 0;
    y < (await page.evaluate(() => document.body.scrollHeight));
    y += 600
  ) {
    await page.evaluate((position) => scrollTo(0, position), y);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(650);
  await page.evaluate(async () => {
    for (const image of document.querySelectorAll("img")) {
      image.loading = "eager";
      await image.decode().catch(() => {});
    }
  });
  expect(
    await page
      .locator("img")
      .evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
      ),
  ).toBeTruthy();
  await page.screenshot({
    path: `artifacts/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  const invalid = await page.goto("/produto/nao-existe");
  expect(invalid?.status()).toBe(404);
});

test("search supports accent normalization, empty state and keyboard navigation", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "Buscar produtos" }).click();
  const search = page.getByRole("textbox", { name: "Buscar produtos" });
  await expect(search).toBeFocused();
  await search.fill("organizacao");
  await expect(page.locator(".search-results a")).not.toHaveCount(0);
  await search.fill("zzzzzzzz");
  await expect(
    page.getByText("Nenhum produto encontrado.", { exact: false }),
  ).toBeVisible();
  await search.fill("compact preto");
  await search.press("ArrowDown");
  await expect(page.locator(".search-results a").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/produto\/case-compact-preto/);
  await page.getByRole("button", { name: "Buscar produtos" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Buscar produtos" }),
  ).toBeFocused();
});

test("catalog filters, ordering, categories, favorites and mobile menu work", async ({
  page,
}, testInfo) => {
  await enter(page, "/loja");
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page.getByLabel("Categoria", { exact: true }).selectOption("cases");
  await expect(page.locator(".catalog .product-card")).toHaveCount(2);
  await page.getByLabel("Ordenar por").selectOption("maior");
  await expect(page.locator(".product-card h3").first()).toHaveText(
    "Case Essential Grafite",
  );
  await page.getByLabel("Apenas novidades").check();
  await expect(page.locator(".catalog .product-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: /Adicionar Case Compact Preto aos favoritos/ })
    .click();
  await page.goto("/favoritos");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".product-card")).toHaveCount(1);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("navigation", { name: "Menu mobile" })
      .getByRole("link", { name: "Categorias", exact: true })
      .click();
  } else await page.goto("/categorias");
  await page
    .locator("main")
    .getByRole("link", { name: "Cases", exact: true })
    .click();
  await expect(page).toHaveURL(/categoria\/cases/);
  await expect(page.locator(".product-card")).toHaveCount(2);
});

test("cart quantities, variants, stock ceiling, persistence and removal", async ({
  page,
}) => {
  await enter(page, "/produto/case-compact-preto");
  await page.getByLabel("Grafite", { exact: true }).check();
  await page
    .getByRole("button", { name: "Adicionar Case Compact Preto ao carrinho" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Grafite", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: /Aumentar quantidade/ }).click();
  await expect(
    dialog.getByLabel("Quantidade de Case Compact Preto", { exact: true }),
  ).toHaveText("2");
  await dialog.getByRole("link", { name: "Ver carrinho" }).click();
  await expect(page).toHaveURL(/\/carrinho$/);
  await page.reload();
  await expect(
    page.getByLabel("Quantidade de Case Compact Preto", { exact: true }),
  ).toHaveText("2");
  await page.getByRole("button", { name: /Diminuir quantidade/ }).click();
  await expect(
    page.getByRole("button", { name: /Diminuir quantidade/ }),
  ).toBeDisabled();
  for (let i = 1; i < 12; i++)
    await page.getByRole("button", { name: /Aumentar quantidade/ }).click();
  await expect(
    page.getByRole("button", { name: /Aumentar quantidade/ }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Quantidade de Case Compact Preto", { exact: true }),
  ).toHaveText("12");
  await page
    .getByRole("button", { name: /Remover Case Compact Preto do carrinho/ })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Seu carrinho está esperando por você.",
    }),
  ).toBeVisible();
});

test("checkout shows honest payment-disabled state without creating fake demo orders", async ({
  page,
}) => {
  await enter(page, "/produto/case-compact-preto");
  await page
    .getByRole("button", { name: "Adicionar Case Compact Preto ao carrinho" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Finalizar pedido" })
    .click();
  await expect(page).toHaveURL(/\/checkout$/);

  await expect(page.locator("input[name='cardNumber']")).toHaveCount(0);
  await expect(page.locator('input[autocomplete="cc-number"]')).toHaveCount(0);
  await expect(page.locator("#checkout-demo")).toHaveCount(0);
  await expect(
    page.getByText("Pagamentos online indisponíveis para pedidos comerciais."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Entrar na conta" }),
  ).toBeVisible();

  await page.evaluate(() => {
    sessionStorage.setItem(
      "th-demo-order",
      JSON.stringify({ number: "TH-DEADBEEF", total: 49.9, count: 1 }),
    );
  });
  await page.goto("/pedido-confirmado");
  await expect(
    page.getByRole("heading", { name: "ACOMPANHAMENTO NA SUA CONTA." }),
  ).toBeVisible();
  await expect(page.getByText("PEDIDO RECEBIDO.")).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("th-demo-order")),
  ).toBeNull();
  await page.goto("/carrinho");
  await expect(
    page.getByText("Case Compact Preto").first(),
  ).toBeVisible();
});

test("basic accessibility for age gate, home, search and checkout", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Sim, tenho 18+" }).click();
  await page.waitForTimeout(650);
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Buscar produtos" }).click();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await page.goto("/produto/case-compact-preto");
  await page
    .getByRole("button", { name: "Adicionar Case Compact Preto ao carrinho" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Finalizar pedido" })
    .click();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("blocked storage preserves an operable in-memory cart", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await enter(page, "/produto/case-compact-preto");
  await page
    .getByRole("button", { name: "Adicionar Case Compact Preto ao carrinho" })
    .click();
  await expect(page.locator(".storage-notice")).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByLabel("Quantidade de Case Compact Preto", { exact: true }),
  ).toHaveText("1");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Ver carrinho" })
    .click();
  await expect(
    page.getByLabel("Quantidade de Case Compact Preto", { exact: true }),
  ).toHaveText("1");
});

test("drawers trap focus and close on outside click; intermediate widths fit", async ({
  page,
}) => {
  await enter(page);
  for (const width of [320, 375, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: /Abrir carrinho/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      ),
    ).toBeTruthy();
  }
  await page.mouse.click(100, 300);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Abrir carrinho/ }),
  ).toBeFocused();
});

test("corrupt storage recovers without crashing and reduced motion stays operable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("th-cart-v1", "{bad-json");
    localStorage.setItem("th-age-confirmed", "yes");
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/carrinho");
  await expect(
    page.getByRole("heading", {
      name: "Seu carrinho está esperando por você.",
    }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "SEU ESTILO.", level: 1 }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
});

test("storefront polish: search clear/enter, active filter chips and stock limit notice", async ({
  page,
}, testInfo) => {
  await enter(page);
  await page.getByRole("button", { name: "Buscar produtos" }).click();
  const search = page.getByRole("textbox", { name: "Buscar produtos" });
  await page
    .getByRole("button", { name: "Case", exact: true })
    .click();
  await expect(search).toHaveValue("Case");
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await search.fill("bandeja");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/loja\?q=bandeja/);
  const activeFilters = page.getByLabel("Filtros ativos");
  await expect(activeFilters).toContainText("Busca: “bandeja”");
  await activeFilters.getByRole("button", { name: /Busca:/ }).click();
  await expect(page).toHaveURL(/\/loja$/);

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const mobileNav = page.getByRole("navigation", { name: "Menu mobile" });
    await expect(
      mobileNav.getByRole("link", { name: "Loja", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("dialog").getByRole("link", { name: "Favoritos" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  }

  await page.goto("/produto/kit-rotina");
  for (let i = 1; i < 5; i++)
    await page.getByRole("button", { name: /Aumentar quantidade/ }).click();
  await expect(page.locator(".stock-limit")).toContainText("Limite de 5");
});
