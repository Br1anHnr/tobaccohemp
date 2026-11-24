import { defineConfig, devices } from "@playwright/test";

// Teste de integração com o backend real (Neon/PostgreSQL). Um único servidor
// Next.js serve as rotas de API administrativas e o dashboard; nada é mockado.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Defina DATABASE_URL com a conexão Neon (PostgreSQL).");
}
const adminPassword = process.env.ADMIN_PASSWORD ?? "synthetic-integration-password";
const front = "http://127.0.0.1:3210";

export default defineConfig({
  testDir: "./tests/integration",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 90000,
  use: { baseURL: front, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3210",
    url: `${front}/admin/login`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: databaseUrl,
      ADMIN_PASSWORD: adminPassword,
      ADMIN_INTEGRATION_TEST: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      ASAAS_SANDBOX_ENABLED: "0",
      // Use local storage unless the integration runner explicitly received R2 settings.
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ?? "",
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
      R2_BUCKET: process.env.R2_BUCKET ?? "",
      R2_PUBLIC_URL: process.env.R2_PUBLIC_URL ?? "",
    },
  },
});
