import { createHash, timingSafeEqual } from "node:crypto";
import { AdminError } from "@/shared/server/validation";
import { customerAuthEnabled, previewOrigin } from "@/shared/server/preview";
import { ASAAS_SANDBOX } from "@/lib/constants";

export const ASAAS_SANDBOX_BASE = ASAAS_SANDBOX.apiBase;
export const ASAAS_SANDBOX_CHECKOUT = ASAAS_SANDBOX.checkoutBase;

export function sandboxEnabled() {
  return process.env.ASAAS_SANDBOX_ENABLED === "1" &&
    process.env.ASAAS_SANDBOX_DATASET === "synthetic" && customerAuthEnabled() &&
    (!process.env.VERCEL || (previewOrigin() !== null && process.env.VERCEL_GIT_COMMIT_REF === "sandbox/asaas-preview"));
}

export function sandboxConfig() {
  const key = process.env.ASAAS_SANDBOX_API_KEY ?? "";
  const token = process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN ?? "";
  if (!sandboxEnabled() || !key || token.length < 32 || token === key) {
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

export class AsaasClient {
  constructor(private readonly transport: typeof fetch = fetch) {}

  async request(path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { key } = sandboxConfig();
    if (!/^\/(payments(?:[/?]|$)|checkouts$)/.test(path)) throw new Error("Unsupported Asaas resource");
    try {
      const response = await this.transport(`${ASAAS_SANDBOX_BASE}${path}`, {
        method: body ? "POST" : "GET", redirect: "error", cache: "no-store",
        signal: AbortSignal.timeout(10_000),
        headers: { access_token: key, "Content-Type": "application/json", "User-Agent": "TobaccoHemp-Sandbox/1.0" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw new Error("Provider failure");
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid response");
      return value as Record<string, unknown>;
    } catch {
      // No provider response bodies, request bodies, PII or keys in errors/logs.
      throw new AdminError(502, "ASAAS_UNAVAILABLE", "Asaas Sandbox indisponível. Consulte o pedido antes de tentar novamente.");
    }
  }
}
