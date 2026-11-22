import { defineConfig } from "@playwright/test";
if (process.env.ASAAS_DISPOSABLE_TEST !== "1" || new URL(process.env.DATABASE_URL ?? "").hostname !== "127.0.0.1") throw new Error("Use node scripts/validate-asaas-sandbox.mjs with its disposable local PostgreSQL.");
export default defineConfig({ testDir: "./tests/sandbox", outputDir: ".preview-validation/asaas-backend-results", workers: 1, fullyParallel: false, retries: 0, timeout: 60_000, reporter: "list" });
