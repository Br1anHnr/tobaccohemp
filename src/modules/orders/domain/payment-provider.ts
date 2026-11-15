import type {
  OrderChannel,
  OrderPaymentMethod,
  PaymentProviderId,
} from "@/shared/contracts/orders";
import { AdminError } from "@/shared/server/validation";

export interface PaymentIntentRequest {
  orderNumber: string;
  amountCents: number;
  currency: "BRL";
  channel: OrderChannel;
  method: OrderPaymentMethod;
  isDemo: boolean;
  expiresAt: string;
}

export interface PaymentIntentResult {
  provider: PaymentProviderId;
  providerReference: string;
  status: "pending_payment";
  checkoutUrl: string | null;
  pixCopyPaste?: string;
  isDemo: true;
  notice: string;
}

export interface PaymentWebhookVerification {
  supported: boolean;
  verified: false;
  reason: string;
}

/**
 * Decoupled payment provider contract (PRD §5). Real gateway adapters
 * (PagBank / Asaas) must implement this port and remain disabled until approved.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly displayName: string;
  readonly isSandboxOnly: boolean;
  createPaymentIntent(request: PaymentIntentRequest): PaymentIntentResult;
  verifyWebhook?(payload: unknown, signature?: string | null): PaymentWebhookVerification;
}

function buildDemoPixCode(orderNumber: string, amountCents: number): string {
  const formatted = (amountCents / 100).toFixed(2);
  return `000201-DEMO-TOBACCO-HEMP-${orderNumber}-BRL-${formatted}-SEM-VALOR-FINANCEIRO`;
}

export const demoPaymentProvider: PaymentProvider = {
  id: "demo",
  displayName: "Provedor Demonstrativo (Sandbox)",
  isSandboxOnly: true,
  createPaymentIntent(request) {
    if (!request.isDemo) {
      throw new AdminError(
        403,
        "REAL_CHARGE_DISABLED",
        "Cobranças reais não estão habilitadas nesta etapa.",
      );
    }
    const suffix = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const providerReference = `DEMO-${request.orderNumber}-${suffix}`;
    const pixCopyPaste =
      request.method === "pix" || request.channel === "whatsapp_link"
        ? buildDemoPixCode(request.orderNumber, request.amountCents)
        : undefined;

    const notice =
      request.channel === "whatsapp_link"
        ? "Simulação de link Pix para atendimento via WhatsApp. Nenhum provedor ativo e nenhuma cobrança gerada."
        : request.method === "card"
          ? "Simulação de checkout hospedado para cartão. Nenhum dado de cartão foi coletado ou processado."
          : "Simulação de Pix demonstrativo. O código exibido é fictício e não possui valor financeiro.";

    return {
      provider: "demo",
      providerReference,
      status: "pending_payment",
      checkoutUrl: null,
      pixCopyPaste,
      isDemo: true,
      notice,
    };
  },
  verifyWebhook() {
    return {
      supported: false,
      verified: false,
      reason: "Provedor demonstrativo não processa webhooks financeiros reais.",
    };
  },
};

export function getPaymentProvider(providerId: PaymentProviderId = "demo"): PaymentProvider {
  if (providerId === "demo") {
    return demoPaymentProvider;
  }
  throw new AdminError(
    503,
    "PROVIDER_NOT_ENABLED",
    `O provedor "${providerId}" ainda não está homologado nem habilitado.`,
  );
}
