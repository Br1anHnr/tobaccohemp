import { defineConfig, devices } from "@playwright/test";

const backend = process.env.GOLDEN_IMAGE_BACKEND_DIR;
if (!backend) throw new Error("Defina GOLDEN_IMAGE_BACKEND_DIR com o checkout local da Golden Image.");
const front = "http://127.0.0.1:3210";
const back = "http://127.0.0.1:3211";

export default defineConfig({
  testDir: "./tests/integration", fullyParallel: false, workers: 1, retries: 0,
  reporter: "list", timeout: 90000,
  use: { baseURL: front, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3211",
      cwd: backend, url: `${back}/api/admin/auth/session`, reuseExistingServer: false, timeout: 120000,
      env: { GOLDEN_IMAGE_ADMIN_PASSWORD: "synthetic-integration-password", NEXT_TELEMETRY_DISABLED: "1" },
    },
    {
      command: "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3210",
      url: `${front}/admin/login`, reuseExistingServer: false, timeout: 120000,
      env: { GOLDEN_IMAGE_API_ORIGIN: back, GOLDEN_IMAGE_INTEGRATION_TEST: "1", NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
