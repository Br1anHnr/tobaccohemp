import type { NextRequest } from "next/server";

/** Server-only opt-in. Never infer authorization from a caller's headers. */
export function previewOrigin(): string | null {
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "preview" ||
      !["homologacao/funcional-e2e", "sandbox/asaas-preview"].includes(process.env.VERCEL_GIT_COMMIT_REF ?? "") ||
      process.env.PREVIEW_BACKEND_ENABLED !== "1") return null;
  try {
    const url = new URL(process.env.APP_ORIGIN ?? "");
    if (url.protocol !== "https:" || url.username || url.password ||
        url.origin !== process.env.APP_ORIGIN) return null;
    return url.origin;
  } catch { return null; }
}

export function localAuthEnabled(): boolean {
  return !process.env.VERCEL && ["development", "test"].includes(process.env.NODE_ENV ?? "");
}

export function customerAuthEnabled(): boolean {
  return localAuthEnabled() || previewOrigin() !== null;
}

export function mutationOrigin(request: NextRequest): string {
  return previewOrigin() ?? `${request.nextUrl.protocol}//${request.headers.get("host")}`;
}

export function secureSession(request: NextRequest): boolean {
  return previewOrigin() !== null || request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
}
