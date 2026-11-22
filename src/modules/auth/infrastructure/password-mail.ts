import { AdminError } from "@/shared/server/validation";
import { previewOrigin } from "@/shared/server/preview";

/** Capture only: Mailpit's HTTP API, restricted to loopback, never public SMTP. */
export function passwordMailEndpoint(): URL {
  const origin = previewOrigin();
  let endpoint: URL;
  try {
    endpoint = new URL(process.env.MAILPIT_URL ?? "");
    if (endpoint.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname) ||
        endpoint.username || endpoint.password || endpoint.pathname !== "/" || endpoint.search || endpoint.hash || !origin) throw new Error();
  } catch {
    throw new AdminError(503, "MAIL_NOT_CONFIGURED", "Recuperação de senha indisponível neste ambiente de homologação.");
  }
  return endpoint;
}

export async function deliverPasswordReset(email: string, token: string): Promise<void> {
  const endpoint = passwordMailEndpoint();
  const link = new URL("/conta/redefinir-senha", previewOrigin()!);
  link.searchParams.set("token", token);
  const response = await fetch(new URL("/api/v1/send", endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ From: { Email: "no-reply@example.test", Name: "Tobacco Hemp — sandbox" },
      To: [{ Email: email }], Subject: "Redefinição de senha — sandbox", Text: `Ambiente de demonstração. Redefina sua senha: ${link.href}` }),
    signal: AbortSignal.timeout(5000), redirect: "error",
  }).catch(() => null);
  if (!response?.ok) throw new AdminError(503, "MAIL_UNAVAILABLE", "Sandbox de e-mail indisponível.");
}
