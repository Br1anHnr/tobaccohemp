import { createHash, timingSafeEqual } from "node:crypto";
import { hasIsolatedSandboxDatabase } from "@/shared/server/database";
import { AdminError } from "@/shared/server/validation";
import { customerAuthEnabled, localAuthEnabled, previewOrigin, productionOrigin } from "@/shared/server/preview";
import { ASAAS_SANDBOX } from "@/lib/constants";

export const ASAAS_SANDBOX_BASE = ASAAS_SANDBOX.apiBase;
export const ASAAS_SANDBOX_CHECKOUT = ASAAS_SANDBOX.checkoutBase;
export const ASAAS_SANDBOX_CHECKOUT_ORIGIN = new URL(ASAAS_SANDBOX_CHECKOUT).origin;

export class AsaasProviderError extends AdminError {
  constructor(
    readonly httpStatus: number | null,
    readonly providerCode: string,
  ) {
    super(
      502,
      "ASAAS_UNAVAILABLE",
      "Asaas Sandbox indisponível. Consulte o pedido antes de tentar novamente.",
    );
  }
}

export function sandboxEnabled() {
  return process.env.ASAAS_SANDBOX_ENABLED === "1" &&
    process.env.ASAAS_SANDBOX_DATASET === "synthetic" && customerAuthEnabled() &&
    (!process.env.VERCEL || (previewOrigin() !== null && process.env.VERCEL_GIT_COMMIT_REF === "sandbox/asaas-preview"));
}

/** Restricted admin-only Sandbox mode: permitted in Production ONLY when explicitly enabled with an isolated Neon DB. */
export function adminSandboxEnabled() {
  if (
    process.env.ASAAS_SANDBOX_ENABLED !== "1" ||
    process.env.ASAAS_SANDBOX_DATASET !== "synthetic"
  ) {
    return false;
  }
  if (!process.env.VERCEL) {
    return localAuthEnabled();
  }
  if (
    previewOrigin() !== null &&
    process.env.VERCEL_GIT_COMMIT_REF === "sandbox/asaas-preview"
  ) {
    return true;
  }
  if (productionOrigin() !== null) {
    return (
      process.env.ADMIN_ENABLED === "1" &&
      process.env.ASAAS_SANDBOX_ADMIN_ONLY === "1" &&
      hasIsolatedSandboxDatabase()
    );
  }
  return false;
}

export function isProductionAdminSandbox() {
  return (
    process.env.VERCEL === "1" &&
    process.env.VERCEL_ENV === "production" &&
    adminSandboxEnabled()
  );
}

export function sandboxConfig(mode: "public" | "admin" | "any" = "any") {
  const key = process.env.ASAAS_SANDBOX_API_KEY ?? "";
  const token = process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN ?? "";
  const enabled =
    mode === "public"
      ? sandboxEnabled()
      : mode === "admin"
        ? adminSandboxEnabled()
        : sandboxEnabled() || adminSandboxEnabled();
  if (!enabled || !key || token.length < 32 || token === key) {
    throw new AdminError(503, "ASAAS_SANDBOX_NOT_CONFIGURED", "Asaas Sandbox não configurado.");
  }
  return { key, token, customer: process.env.ASAAS_SANDBOX_CUSTOMER_ID ?? "",
    productIds: new Set((process.env.ASAAS_SANDBOX_PRODUCT_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean)) };
}

export function authenticateAsaasWebhook(value: string | null) {
  const { token } = sandboxConfig();
  // Hash both inputs so timingSafeEqual always compares equal-length buffers.
  const hash = (s: string) => createHash("sha256").update(s).digest();
  if (!value || !timingSafeEqual(hash(value), hash(token))) {
    throw new AdminError(401, "INVALID_WEBHOOK_TOKEN", "Autenticação do webhook inválida.");
  }
}

export function resourceId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(value)) {
    throw new AdminError(422, "INVALID_PROVIDER_RESOURCE", "Identificador do provedor inválido.");
  }
  return value;
}

export function checkoutUrl(id: string) {
  return `${ASAAS_SANDBOX_CHECKOUT}?id=${encodeURIComponent(resourceId(id))}`;
}

function extractProviderCode(status: number, payload: unknown): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const errors = (payload as { errors?: unknown }).errors;
    if (Array.isArray(errors)) {
      const codes = errors
        .slice(0, 3)
        .map((entry) =>
          entry && typeof entry === "object" && typeof (entry as { code?: unknown }).code === "string"
            ? (entry as { code: string }).code.trim()
            : "",
        )
        .filter((code) => /^[A-Za-z0-9_.-]{1,64}$/.test(code));
      if (codes.length > 0) {
        return codes.join(",").slice(0, 120);
      }
    }
  }
  return `HTTP_${status}`;
}

export class AsaasClient {
  constructor(private readonly transport: typeof fetch = fetch) {}

  async request(path: string, body?: Record<string, unknown>, method = body ? "POST" : "GET"): Promise<Record<string, unknown>> {
    const { key } = sandboxConfig();
    if (!/^\/(payments(?:[/?]|$)|checkouts(?:\/[A-Za-z0-9_-]+\/cancel)?$)/.test(path)) throw new Error("Unsupported Asaas resource");
    let httpStatus: number | null = null;
    let providerCode = "NETWORK_ERROR";
    try {
      const response = await this.transport(`${ASAAS_SANDBOX_BASE}${path}`, {
        method, redirect: "error", cache: "no-store",
        signal: AbortSignal.timeout(10_000),
        headers: { access_token: key, "Content-Type": "application/json", "User-Agent": "TobaccoHemp-Sandbox/1.0" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      httpStatus = response.status;
      if (!response.ok) {
        const errPayload: unknown = await response.json().catch(() => null);
        providerCode = extractProviderCode(response.status, errPayload);
        throw new AsaasProviderError(httpStatus, providerCode);
      }
      const value: unknown = await response.json().catch(() => null);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        providerCode = "INVALID_RESPONSE";
        throw new AsaasProviderError(httpStatus, providerCode);
      }
      return value as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AsaasProviderError) {
        console.error("[asaas-sandbox] provider_error", {
          method,
          path: path.split("?")[0],
          httpStatus: error.httpStatus,
          providerCode: error.providerCode,
        });
        throw error;
      }
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        providerCode = "TIMEOUT";
      }
      // No provider response bodies, request bodies, PII or keys in errors/logs.
      console.error("[asaas-sandbox] provider_error", {
        method,
        path: path.split("?")[0],
        httpStatus,
        providerCode,
      });
      throw new AsaasProviderError(httpStatus, providerCode);
    }
  }
}
