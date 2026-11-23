"use client";
import { useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { useOrder } from "@/store/order-store";
import { STORAGE } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/Button";

export function OrderConfirmation() {
  const setOrder = useOrder((s) => s.setOrder);

  useEffect(() => {
    setOrder(null);
    try {
      sessionStorage.removeItem(STORAGE.order);
    } catch {
      /* Ignore storage restrictions. */
    }
  }, [setOrder]);

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
