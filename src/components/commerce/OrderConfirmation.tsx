"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useOrder } from "@/store/order-store";
import { STORAGE } from "@/lib/constants";
import { currency } from "@/lib/currency";
import { ButtonLink } from "@/components/ui/Button";
export function OrderConfirmation() {
  const order = useOrder((s) => s.order);
  const setOrder = useOrder((s) => s.setOrder);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!order) {
        try {
          const saved = JSON.parse(
            sessionStorage.getItem(STORAGE.order) ?? "null",
          );
          if (
            saved &&
            /^TH-[A-F0-9]{8}$/.test(saved.number) &&
            Number.isFinite(saved.total) &&
            saved.total > 0 &&
            Number.isInteger(saved.count) &&
            saved.count > 0
          )
            setOrder(saved);
        } catch {
          /* Invalid stored receipt is ignored. */
        }
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [order, setOrder]);
  if (!ready) return <p role="status">Carregando confirmação…</p>;
  return (
    <div className="confirmation">
      <span className="confirmation-icon">
        <Check size={32} />
      </span>
      <p className="eyebrow">
        {order
          ? "Você concluiu a experiência"
          : "Sua próxima escolha espera por você"}
      </p>
      <h1>{order ? "PEDIDO RECEBIDO." : "AINDA SEM PEDIDO."}</h1>
      {order ? (
        <>
          <p>
            Seu pedido demonstrativo <strong>{order.number}</strong> foi
            recebido.
          </p>
          <div className="receipt">
            <span>{order.count} itens</span>
            <strong>{currency(order.total)}</strong>
            <span>Entrega a combinar</span>
          </div>
          <p>
            Nenhuma cobrança foi realizada.
            <br />
            Este pedido não foi enviado à loja.
          </p>
        </>
      ) : (
        <p>Finalize um checkout demonstrativo para ver sua confirmação aqui.</p>
      )}
      <ButtonLink href="/loja">Continuar explorando</ButtonLink>
    </div>
  );
}
