"use client";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useOrder } from "@/store/order-store";
import { STORAGE } from "@/lib/constants";
import { currency } from "@/lib/currency";
import {
  ORDER_PAYMENT_METHOD_LABEL,
  ORDER_STATUS_LABEL,
} from "@/modules/orders/domain/order-status";
import { ButtonLink } from "@/components/ui/Button";

export function OrderConfirmation() {
  const order = useOrder((s) => s.order);
  const setOrder = useOrder((s) => s.setOrder);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

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
            Seu pedido <strong>{order.number}</strong> foi recebido.
          </p>
          <div className="receipt">
            <span>{order.count} itens</span>
            <strong>{currency(order.total)}</strong>
            <span>Entrega a combinar</span>
          </div>

          {order.status && (
            <div className="confirmation-meta">
              <span className="confirmation-pill">
                Status: {ORDER_STATUS_LABEL[order.status]}
              </span>
              {order.paymentMethod && (
                <span className="confirmation-pill">
                  {ORDER_PAYMENT_METHOD_LABEL[order.paymentMethod]}
                </span>
              )}
            </div>
          )}

          {order.providerNotice && (
            <div className="confirmation-sim-box">
              <p>{order.providerNotice}</p>
              {order.providerReference && (
                <p className="confirmation-ref">
                  Código de referência: <code>{order.providerReference}</code>
                </p>
              )}
              {order.pixCopyPaste && (
                <div className="demo-pix-wrap">
                  <code className="demo-pix-code">{order.pixCopyPaste}</code>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(order.pixCopyPaste ?? "")
                        .then(() => setCopied(true))
                        .catch(() => {});
                    }}
                  >
                    <Copy size={14} aria-hidden="true" />
                    {copied ? "Código copiado" : "Copiar código"}
                  </button>
                </div>
              )}
            </div>
          )}

          {order.items && order.items.length > 0 && (
            <details className="confirmation-details">
              <summary>Ver itens e histórico do pedido</summary>
              <ul className="confirmation-items">
                {order.items.map((item) => (
                  <li key={`${item.productId}:${item.variant ?? ""}`}>
                    <span>
                      {item.quantity} × {item.name}
                      {item.variant ? ` · ${item.variant}` : ""}
                    </span>
                    <strong>{currency(item.lineTotalCents / 100)}</strong>
                  </li>
                ))}
              </ul>
              {order.history && order.history.length > 0 && (
                <ol className="confirmation-history">
                  {order.history.map((entry, idx) => (
                    <li key={`${entry.toStatus}-${idx}`}>
                      <strong>
                        {entry.fromStatus
                          ? `${ORDER_STATUS_LABEL[entry.fromStatus]} → ${ORDER_STATUS_LABEL[entry.toStatus]}`
                          : ORDER_STATUS_LABEL[entry.toStatus]}
                      </strong>
                      <span>{entry.reason}</span>
                    </li>
                  ))}
                </ol>
              )}
            </details>
          )}

          <p>
            Nenhuma cobrança foi realizada.
            <br />
            Este pedido não foi enviado à loja.
          </p>
        </>
      ) : (
        <p>Finalize um pedido no checkout para ver sua confirmação aqui.</p>
      )}
      <ButtonLink href="/loja">Continuar explorando</ButtonLink>
    </div>
  );
}
