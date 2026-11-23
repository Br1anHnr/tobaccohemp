"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ExternalLink, LoaderCircle } from "lucide-react";
import { useCart } from "@/store/cart-store";
import { useAccount } from "@/store/account-store";
import { Button, ButtonLink } from "@/components/ui/Button";
import { currency } from "@/lib/currency";
import { sessionExpiredEvent } from "@/lib/admin-service";
import { readSandboxAttempt, saveSandboxAttempt } from "@/lib/sandbox-attempt";
import { ASAAS_SANDBOX, STORAGE } from "@/lib/constants";
import { ORDER_STATUS_LABEL, ORDER_STOCK_STATUS_LABEL } from "@/modules/orders/domain/order-status";
import type { sandboxPaymentView } from "@/modules/orders/infrastructure/asaas-sandbox";

export type SandboxPaymentData = Awaited<ReturnType<typeof sandboxPaymentView>>;
const handleKey = STORAGE.storefrontSandboxAttempt;
const SANDBOX_CHECKOUT_ORIGIN = new URL(ASAAS_SANDBOX.checkoutBase).origin;

export function AsaasSandboxCheckout({
  mode = "preview_sandbox",
  callbackOrderId = null,
  beforeCreate,
  onPaymentChange,
  onResetNotice,
}: {
  mode?: "preview_sandbox" | "admin_sandbox";
  callbackOrderId?: string | null;
  beforeCreate?: () => Promise<boolean>;
  onPaymentChange?: (payment: SandboxPaymentData | null) => void;
  onResetNotice?: (notice: string) => void;
}) {
  const isAdminSandbox = mode === "admin_sandbox";
  const items = useCart(s => s.items);
  const consumeCart = useCart(s => s.consume);
  const customer = useAccount(s => s.customer);
  const canAccessPayment = Boolean(customer) || isAdminSandbox;
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [payment, setPayment] = useState<SandboxPaymentData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hasSavedOrder, setHasSavedOrder] = useState(false);
  const [redirectingUrl, setRedirectingUrl] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const orderId = useRef<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    onPaymentChange?.(payment);
  }, [payment, onPaymentChange]);

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
    setRedirectingUrl(null);
    setMessage(notice);
    onResetNotice?.(notice);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("asaasOrder")) {
      window.history.replaceState(null, "", "/checkout");
    }
  }, [onResetNotice]);

  const load = useCallback(async (id: string, signal?: AbortSignal) => {
    const endpoint = isAdminSandbox
      ? `/api/admin/asaas/orders/${encodeURIComponent(id)}`
      : `/api/checkout/asaas/${encodeURIComponent(id)}`;
    const response = await fetch(endpoint, { cache: "no-store", signal });
    const body = await response.json().catch(() => null);
    if (signal?.aborted) return;
    if (isAdminSandbox && response.status === 401) window.dispatchEvent(new Event(sessionExpiredEvent));
    if (response.status === 404) {
      resetAttempt("Pedido anterior não encontrado nesta conta. Você pode iniciar um novo pedido.");
      return;
    }
    if (!response.ok) throw new Error(body?.error?.message ?? "Falha ao consultar pedido.");
    setPayment(body.data);
  }, [isAdminSandbox, resetAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    const saved = readSandboxAttempt(handleKey);
    if (!callbackOrderId || callbackOrderId === saved.orderId) key.current = saved.key ?? key.current;
    orderId.current = callbackOrderId ?? saved.orderId ?? orderId.current;
    const targetId = orderId.current;
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setHasSavedOrder(Boolean(targetId));
      if (targetId && canAccessPayment) {
        void load(targetId, controller.signal).catch((error) => {
          if (!controller.signal.aborted) setMessage(error.message);
        });
      }
    });
    return () => controller.abort();
  }, [callbackOrderId, canAccessPayment, load]);

  async function create() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setRedirectingUrl(null);
    try {
      if (!orderId.current && beforeCreate) {
        const ready = await beforeCreate();
        if (!ready) return;
      }
      key.current ??= crypto.randomUUID();
      if (orderId.current) {
        await load(orderId.current);
        return;
      }
      saveSandboxAttempt(handleKey, key.current, null);
      const response = await fetch(
        isAdminSandbox ? "/api/admin/asaas/checkout" : "/api/checkout/asaas",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items,
            paymentMethod: method,
            idempotencyKey: key.current,
            ...(isAdminSandbox ? { callbackPath: "/checkout" } : {}),
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (isAdminSandbox && response.status === 401) window.dispatchEvent(new Event(sessionExpiredEvent));
      if (!response.ok) throw new Error(body?.error?.message ?? "Não foi possível registrar o pedido.");
      const data = body.data as SandboxPaymentData;
      orderId.current = data.order.id;
      setHasSavedOrder(true);
      setPayment(data);
      saveSandboxAttempt(handleKey, key.current, orderId.current);
      consumeCart(items);

      if (isAdminSandbox && method === "card" && data.order.checkoutUrl) {
        let parsedOrigin = "";
        try {
          parsedOrigin = new URL(data.order.checkoutUrl).origin;
        } catch {
          parsedOrigin = "";
        }
        if (parsedOrigin === SANDBOX_CHECKOUT_ORIGIN) {
          setRedirectingUrl(data.order.checkoutUrl);
          window.location.assign(data.order.checkoutUrl);
          return;
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function handleCancelOrder() {
    if (!payment || !isAdminSandbox || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/asaas/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: payment.order.id }),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 401) window.dispatchEvent(new Event(sessionExpiredEvent));
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Não foi possível cancelar a tentativa.");
      }
      await load(payment.order.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao cancelar pedido de teste.");
    } finally {
      setBusy(false);
    }
  }

  const canStartAnother =
    Boolean(payment) &&
    (isAdminSandbox ||
      ["paid", "refunded", "canceled", "expired"].includes(payment!.order.status) ||
      ["uncertain", "review"].includes(payment!.attemptState));

  const showPixFallbackNotice = payment?.order.paymentMethod === "pix" &&
    payment.order.status === "pending_payment" && payment.attemptState === "ready" && !payment.pix;

  return (
    <section className="asaas-checkout-card" aria-label="Pagamento do pedido">
      {!canAccessPayment ? (
        <div className="checkout-section checkout-guest-prompt">
          <p>Entre na sua conta ou crie um cadastro para finalizar o pedido.</p>
          <div className="checkout-guest-actions">
            <ButtonLink href="/conta/entrar?next=/checkout">Entrar na conta</ButtonLink>
            <ButtonLink href="/conta/cadastro?next=/checkout" variant="secondary">Criar conta</ButtonLink>
          </div>
        </div>
      ) : (
        <>
          {!payment && !hasSavedOrder && (
            <fieldset className="checkout-section checkout-payment-section" disabled={busy}>
              <legend>{isAdminSandbox ? "3. Pagamento (Asaas Sandbox)" : "Forma de pagamento"}</legend>
              <div className="checkout-choice-grid">
                <label className="checkout-choice" htmlFor="asaas-method-pix">
                  <input
                    id="asaas-method-pix"
                    type="radio"
                    name="asaas-method"
                    checked={method === "pix"}
                    onChange={() => setMethod("pix")}
                  />
                  <span>
                    <strong>Pix</strong>
                    <small>QR Code e código Pix Copia e Cola gerados na hora (ambiente de testes).</small>
                  </span>
                </label>
                <label className="checkout-choice" htmlFor="asaas-method-card">
                  <input
                    id="asaas-method-card"
                    type="radio"
                    name="asaas-method"
                    checked={method === "card"}
                    onChange={() => setMethod("card")}
                  />
                  <span>
                    <strong>Cartão de crédito</strong>
                    <small>
                      {isAdminSandbox
                        ? "Redireciona para o checkout seguro do Asaas Sandbox — nenhum dado do cartão é digitado neste site."
                        : "Pagamento em ambiente seguro externo — nenhum dado do cartão é digitado neste site."}
                    </small>
                  </span>
                </label>
              </div>
            </fieldset>
          )}

          {payment && (
            <div className="summary-panel asaas-payment-details" aria-live="polite">
              <h2>Pedido {payment.order.orderNumber}</h2>
              <p>
                {ORDER_STATUS_LABEL[payment.order.status]} · {currency(payment.order.totalCents / 100)}
              </p>
              <p className="muted">
                {ORDER_STOCK_STATUS_LABEL[payment.order.stockStatus ?? "none"]}
                {isAdminSandbox && payment.sandboxStock?.length
                  ? ` · Estoque isolado: ${payment.sandboxStock
                      .map((entry) => `${entry.productName}: ${entry.quantity} un.`)
                      .join(", ")}`
                  : ""}
              </p>

              {payment.attemptState !== "ready" && (
                <p role="status">
                  {payment.attemptState === "review"
                    ? "Pedido em análise. Aguarde a validação do atendimento."
                    : "Pedido em processamento. Atualize o status abaixo para acompanhar a confirmação."}
                </p>
              )}

              {showPixFallbackNotice && (
                <p role="status">
                  Pedido registrado. O QR Code Pix está temporariamente indisponível nesta conta de testes; atualize o status abaixo ou tente novamente após ativação da chave Pix.
                </p>
              )}
              {payment.order.paymentMethod === "card" && payment.warning && (
                <p role="status">O status do cartão está indisponível. Atualize o pedido para consultar o Asaas Sandbox.</p>
              )}

              {redirectingUrl && (
                <div className="checkout-test-note" role="status">
                  <LoaderCircle size={15} className="spin" aria-hidden="true" />
                  <p>
                    Redirecionando para o checkout hospedado do Asaas Sandbox…{" "}
                    <a className="text-link" href={redirectingUrl}>
                      Clique aqui se não redirecionar
                    </a>
                  </p>
                </div>
              )}

              {payment.pix && (
                <div className="asaas-qr">
                  <Image
                    unoptimized
                    src={`data:image/png;base64,${payment.pix.encodedImage}`}
                    alt="QR Code Pix do pedido"
                    width={240}
                    height={240}
                  />
                  <label className="asaas-code">
                    Pix Copia e Cola
                    <textarea readOnly value={payment.pix.payload} aria-label="Pix Copia e Cola" />
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(payment.pix!.payload);
                        setMessage("Código Pix copiado.");
                      } catch {
                        setMessage("Selecione e copie o código no campo acima.");
                      }
                    }}
                  >
                    Copiar código Pix
                  </Button>
                  <p className="muted">Validade: {payment.pix.expirationDate}</p>
                </div>
              )}

              {payment.order.checkoutUrl &&
                payment.order.status === "pending_payment" &&
                payment.attemptState === "ready" &&
                !payment.warning &&
                !redirectingUrl && (
                  <p>
                    <a
                      className="button button-primary"
                      href={payment.order.checkoutUrl}
                      {...(isAdminSandbox ? {} : { target: "_blank", rel: "noreferrer" })}
                    >
                      Pagar com cartão{" "}
                      {isAdminSandbox ? (
                        <ExternalLink size={17} aria-hidden="true" />
                      ) : (
                        <ArrowRight size={17} aria-hidden="true" />
                      )}
                    </a>
                  </p>
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
              <ul>
                {payment.order.history.map(h => (
                  <li key={h.id}>
                    {ORDER_STATUS_LABEL[h.toStatus]} — {h.reason}
                  </li>
                ))}
              </ul>
              <div className="checkout-actions-row">
                {customer && (
                  <Link href="/conta/pedidos" className="text-link">
                    Ver em Meus pedidos
                  </Link>
                )}
                {isAdminSandbox && (
                  <Link href="/admin/asaas" className="text-link">
                    Ver painel Asaas Sandbox
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="checkout-actions-row">
            <Button
              type="button"
              variant={payment || hasSavedOrder ? "secondary" : "primary"}
              className={!payment && !hasSavedOrder ? "checkout-submit" : ""}
              disabled={busy}
              onClick={create}
            >
              {busy
                ? payment || hasSavedOrder
                  ? "Atualizando…"
                  : isAdminSandbox && method === "card"
                    ? "Redirecionando para o Asaas…"
                    : "Finalizando…"
                : payment || hasSavedOrder
                  ? "Atualizar status do pedido"
                  : "Finalizar pedido"}
              {!payment && !hasSavedOrder && <ArrowRight size={18} aria-hidden="true" />}
            </Button>
            {isAdminSandbox &&
              payment &&
              !["paid", "refunded", "canceled", "expired"].includes(payment.order.status) && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    void handleCancelOrder();
                  }}
                >
                  Cancelar e liberar estoque
                </Button>
              )}
            {canStartAnother && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => resetAttempt("")}>
                Fazer novo pedido
              </Button>
            )}
            {!payment && hasSavedOrder && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => resetAttempt("")}>
                Descartar tentativa anterior
              </Button>
            )}
          </div>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
