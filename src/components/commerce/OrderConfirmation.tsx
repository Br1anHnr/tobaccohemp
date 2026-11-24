"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useOrder } from "@/store/order-store";
import { STORAGE } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/Button";
import { useAccount } from "@/store/account-store";
import { sandboxOrderId } from "@/lib/sandbox-attempt";
import { AsaasSandboxCheckout } from "./AsaasSandboxCheckout";

export function OrderConfirmation() {
  const setOrder = useOrder((s) => s.setOrder);
  const orderId = sandboxOrderId(useSearchParams().get("asaasOrder"));
  const hydrated = useAccount(s => s.hydrated);
  const sessionPending = useAccount(s => s.sessionPending);

  useEffect(() => {
    setOrder(null);
    try {
      sessionStorage.removeItem(STORAGE.order);
    } catch {
      /* Ignore storage restrictions. */
    }
  }, [setOrder]);

  if (orderId) {
    return <>
      <h1>Acompanhar pedido</h1>
      <p>Asaas Sandbox · pagamento de teste, sem cobrança ou envio real.</p>
      {!hydrated || sessionPending ? <p role="status">Carregando pedido…</p>
        : <AsaasSandboxCheckout mode="customer_sandbox" callbackOrderId={orderId} confirmation />}
    </>;
  }

  return (
    <div className="confirmation">
      <span className="confirmation-icon">
        <ShieldCheck size={32} aria-hidden="true" />
      </span>
      <p className="eyebrow">Acompanhamento de pedidos</p>
      <h1>ACOMPANHAMENTO NA SUA CONTA.</h1>
      <p>
        Nenhum pedido comercial é confirmado sem aprovação de pagamento pelo provedor.
      </p>
      <p>
        Consulte seus pedidos, pagamentos pendentes e atualizações de status diretamente em Meus pedidos.
      </p>
      <div className="checkout-guest-actions">
        <ButtonLink href="/conta/pedidos">Ver meus pedidos</ButtonLink>
        <ButtonLink href="/loja" variant="secondary">
          Continuar explorando
        </ButtonLink>
      </div>
    </div>
  );
}
