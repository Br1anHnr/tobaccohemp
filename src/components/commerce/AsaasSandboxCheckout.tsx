"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/store/cart-store";
import { useAccount } from "@/store/account-store";
import { Button } from "@/components/ui/Button";
import { currency } from "@/lib/currency";
import { ASAAS_SANDBOX } from "@/lib/constants";
import { ORDER_STATUS_LABEL, ORDER_STOCK_STATUS_LABEL } from "@/modules/orders/domain/order-status";
import type { sandboxPaymentView } from "@/modules/orders/infrastructure/asaas-sandbox";

type Payment = Awaited<ReturnType<typeof sandboxPaymentView>>;
const handleKey = "th-asaas-sandbox-attempt";

export function AsaasSandboxCheckout() {
  const items = useCart(s => s.items);
  const clearCart = useCart(s => s.clear);
  const customer = useAccount(s => s.customer);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hasSavedOrder, setHasSavedOrder] = useState(false);
  const key = useRef<string | null>(null);
  const orderId = useRef<string | null>(null);
  const lock = useRef(false);

  const resetAttempt = useCallback((notice = "") => {
    try {
      sessionStorage.removeItem(handleKey);
    } catch {
      /* Ignore storage restriction. */
    }
    key.current = null;
    orderId.current = null;
    setHasSavedOrder(false);
    setPayment(null);
    setMessage(notice);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("asaasOrder")) {
      window.history.replaceState(null, "", "/checkout");
    }
  }, []);

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/checkout/asaas/${encodeURIComponent(id)}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (response.status === 404) {
      resetAttempt("Tentativa anterior não pertence a esta conta ou não foi encontrada. Você pode iniciar um novo pedido.");
      return;
    }
    if (!response.ok) throw new Error(body?.error?.message ?? "Falha ao consultar pedido.");
    setPayment(body.data);
  }, [resetAttempt]);

  useEffect(() => {
    const callbackId = new URLSearchParams(window.location.search).get("asaasOrder");
    try {
      const saved = JSON.parse(sessionStorage.getItem(handleKey) ?? "null");
      key.current = saved?.key ?? null;
      orderId.current = callbackId ?? saved?.orderId ?? null;
    } catch {
      orderId.current = callbackId;
    }
    setHasSavedOrder(Boolean(orderId.current));
    if (orderId.current && customer) {
      void load(orderId.current).catch(error => setMessage(error.message));
    }
  }, [customer, load]);

  async function create() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      key.current ??= crypto.randomUUID();
      sessionStorage.setItem(handleKey, JSON.stringify({ key: key.current, orderId: orderId.current }));
      if (orderId.current) {
        await load(orderId.current);
        return;
      }
      const response = await fetch("/api/checkout/asaas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, paymentMethod: method, idempotencyKey: key.current }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "Falha ao criar pedido Sandbox.");
      const data = body.data as Payment;
      orderId.current = data.order.id;
      setHasSavedOrder(true);
      sessionStorage.setItem(handleKey, JSON.stringify({ key: key.current, orderId: orderId.current }));
      setPayment(data);
      clearCart();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no Sandbox.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  const canStartAnother =
    Boolean(payment) &&
    (["paid", "refunded", "canceled", "expired"].includes(payment!.order.status) ||
      ["uncertain", "review"].includes(payment!.attemptState));

  return (
    <section className="summary-panel asaas-checkout" aria-label="Asaas Sandbox">
      <p className="eyebrow">{ASAAS_SANDBOX.notice}</p>
      <h2>Teste de pagamento</h2>
      <p>Use apenas conta e acessórios sintéticos autorizados. O cartão é informado na página hospedada pelo Asaas.</p>
      {!customer ? (
        <p><Link href="/conta/entrar" className="text-link">Entre com sua conta de teste</Link> para continuar.</p>
      ) : (
        <>
          {!payment && !hasSavedOrder && (
            <fieldset disabled={busy}>
              <legend>Forma de pagamento Sandbox</legend>
              <label className="checkout-choice">
                <input type="radio" name="asaas-method" checked={method === "pix"} onChange={() => setMethod("pix")} /> Pix dinâmico Sandbox
              </label>
              <label className="checkout-choice">
                <input type="radio" name="asaas-method" checked={method === "card"} onChange={() => setMethod("card")} /> Cartão hospedado Sandbox
              </label>
            </fieldset>
          )}
          {payment && (
            <div className="asaas-payment-details" aria-live="polite">
              <h3>{payment.order.orderNumber}</h3>
              <p>{ORDER_STATUS_LABEL[payment.order.status]} · {currency(payment.order.totalCents / 100)}</p>
              <p>{ORDER_STOCK_STATUS_LABEL[payment.order.stockStatus ?? "none"]}</p>
              {payment.attemptState !== "ready" && (
                <p role="status">
                  {payment.attemptState === "review"
                    ? "Pedido em revisão. Aguarde a conciliação do responsável pelo Sandbox."
                    : "Tentativa registrada. Consulte este pedido para conciliar ou inicie outro pedido se a tentativa falhou."}
                </p>
              )}
              {payment.warning && (
                <p role="status">
                  Não foi possível concluir a consulta ao provedor. Tente consultar novamente.
                  {payment.diagnostic ? ` (Diagnóstico: ${payment.diagnostic.code}${payment.diagnostic.httpStatus ? ` · HTTP ${payment.diagnostic.httpStatus}` : ""})` : ""}
                </p>
              )}
              {!payment.warning && payment.diagnostic && (
                <p role="status">
                  Diagnóstico do provedor: {payment.diagnostic.code}
                  {payment.diagnostic.httpStatus ? ` (HTTP ${payment.diagnostic.httpStatus})` : ""}
                </p>
              )}
              {payment.pix && (
                <div className="asaas-qr">
                  <Image unoptimized src={`data:image/png;base64,${payment.pix.encodedImage}`} alt="QR Code Pix dinâmico do pedido de teste Sandbox" width={240} height={240} />
                  <label className="asaas-code">Pix Copia e Cola<textarea readOnly value={payment.pix.payload} aria-label="Pix Copia e Cola" /></label>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(payment.pix!.payload);
                        setMessage("Código Pix Sandbox copiado.");
                      } catch {
                        setMessage("Selecione e copie o código no campo acima.");
                      }
                    }}
                  >
                    Copiar código Pix Sandbox
                  </Button>
                  <p>Validade informada pelo Asaas: {payment.pix.expirationDate}</p>
                </div>
              )}
              {payment.order.checkoutUrl && payment.order.status === "pending_payment" && payment.attemptState === "ready" && !payment.warning && (
                <p><a className="button button-primary" href={payment.order.checkoutUrl} target="_blank" rel="noreferrer">Abrir cartão no Asaas Sandbox</a></p>
              )}
              {payment.order.items.length > 0 && (
                <>
                  <h3>Itens do pedido</h3>
                  <ul>
                    {payment.order.items.map(item => (
                      <li key={item.id}>
                        {item.quantity} × {item.productName}{item.variant ? ` · ${item.variant}` : ""} — {currency(item.lineTotalCents / 100)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <h3>Histórico do pedido</h3>
              <ul>{payment.order.history.map(h => <li key={h.id}>{ORDER_STATUS_LABEL[h.toStatus]} — {h.reason}</li>)}</ul>
              <p><Link href="/conta/pedidos" className="text-link">Ver em Meus pedidos</Link></p>
            </div>
          )}
          <Button type="button" disabled={busy} onClick={create}>
            {busy ? "Consultando…" : payment || hasSavedOrder ? "Consultar e reconciliar pedido" : "Criar pedido Asaas Sandbox"}
          </Button>
          {canStartAnother && (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => resetAttempt("")}>
              Iniciar outro pedido de teste
            </Button>
          )}
          {!payment && hasSavedOrder && (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => resetAttempt("")}>
              Descartar tentativa salva
            </Button>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
