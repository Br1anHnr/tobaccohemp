"use client";

import { useCallback, useEffect, useState } from "react";
import { currency } from "@/lib/currency";
import { fetchOrderDetail, updateOrderStatus } from "@/lib/admin-service";
import { useResource } from "@/lib/use-resource";
import {
  allowedNextStatuses,
  ORDER_CHANNEL_LABEL,
  ORDER_PAYMENT_METHOD_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STOCK_STATUS_LABEL,
} from "@/modules/orders/domain/order-status";
import type { OrderDetail, OrderStatus } from "@/shared/contracts/orders";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge } from "./Badge";
import { ErrorState, LoadingState } from "./TableStates";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const ACTOR_LABEL: Record<string, string> = {
  system: "Sistema",
  admin: "Administrador",
  customer: "Cliente",
  provider_webhook: "Provedor",
};

const STOCK_ACTION_LABEL: Record<string, string> = {
  reserved: "Estoque reservado",
  committed: "Estoque baixado",
  released: "Estoque devolvido",
};

function OrderDetailBody({
  orderId,
  onLoaded,
  onUpdated,
}: {
  orderId: string;
  onLoaded: (detail: OrderDetail) => void;
  onUpdated: () => void;
}) {
  const fetcher = useCallback(async () => {
    const data = await fetchOrderDetail(orderId);
    onLoaded(data);
    return data;
  }, [orderId, onLoaded]);

  const { status, data: fetched, retry } = useResource(fetcher);
  const [override, setOverride] = useState<OrderDetail | null>(null);
  const [reason, setReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const detail = override ?? fetched;
  const expiresAtMs =
    detail && detail.status === "pending_payment" && detail.expiresAt
      ? new Date(detail.expiresAt).getTime()
      : null;
  const isOverdue = expiresAtMs !== null && expiresAtMs <= nowMs;

  useEffect(() => {
    if (expiresAtMs === null) return;
    const remaining = expiresAtMs - nowMs;
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNowMs(Date.now()), Math.min(remaining + 50, 60_000));
    return () => clearTimeout(timer);
  }, [expiresAtMs, nowMs]);

  if (status === "loading" && !detail) return <LoadingState />;
  if (status === "error" || !detail) return <ErrorState onRetry={retry} />;

  async function handleTransition(nextStatus: OrderStatus) {
    if (!detail || mutating) return;
    setMutating(true);
    setMutationError("");
    try {
      const updated = await updateOrderStatus(detail.id, {
        status: nextStatus,
        reason: reason.trim() || undefined,
      });
      setOverride(updated);
      setReason("");
      onLoaded(updated);
      onUpdated();
    } catch (cause) {
      setMutationError(
        cause instanceof Error ? cause.message : "Não foi possível atualizar o status.",
      );
    } finally {
      setMutating(false);
    }
  }

  const nextStatuses = allowedNextStatuses(detail.status);

  return (
    <div className="order-detail">
      <div className="order-detail__top">
        <div>
          <span className="cell-sub">
            Criado em {dateTimeFormat.format(new Date(detail.createdAt))}
          </span>
          {detail.expiresAt && (
            <span className="cell-sub">
              Expira em {dateTimeFormat.format(new Date(detail.expiresAt))}
            </span>
          )}
        </div>
        <StatusBadge status={detail.status} />
      </div>

      <dl className="order-detail-grid">
        <div>
          <dt>Cliente / Referência</dt>
          <dd>{detail.customerLabel}</dd>
        </div>
        <div>
          <dt>Canal</dt>
          <dd>{ORDER_CHANNEL_LABEL[detail.channel]}</dd>
        </div>
        <div>
          <dt>Forma</dt>
          <dd>{ORDER_PAYMENT_METHOD_LABEL[detail.paymentMethod]}</dd>
        </div>
        <div>
          <dt>Provedor</dt>
          <dd>
            {detail.paymentProvider} ({detail.isDemo ? "demonstrativo" : "ativo"})
          </dd>
        </div>
        <div>
          <dt>Referência do provedor</dt>
          <dd>{detail.providerReference ?? "—"}</dd>
        </div>
        <div>
          <dt>Elegibilidade</dt>
          <dd>
            {detail.eligibilityStatus === "eligible_demo"
              ? "Elegível (modo demonstrativo)"
              : "Bloqueado"}
          </dd>
        </div>
        {detail.stockStatus && (
          <div>
            <dt>Situação do estoque</dt>
            <dd>{ORDER_STOCK_STATUS_LABEL[detail.stockStatus]}</dd>
          </div>
        )}
      </dl>

      <section className="order-detail-section" aria-label="Itens do pedido">
        <h3>Itens com preço congelado</h3>
        <ul className="order-detail-items">
          {detail.items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.productName}</strong>
                <span className="cell-sub">
                  SKU {item.sku}
                  {item.variant ? ` · ${item.variant}` : ""} · {item.quantity} ×{" "}
                  {currency(item.unitPriceCents / 100)}
                </span>
              </div>
              <strong>{currency(item.lineTotalCents / 100)}</strong>
            </li>
          ))}
        </ul>
        <dl className="order-detail-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{currency(detail.subtotalCents / 100)}</dd>
          </div>
          <div>
            <dt>Entrega</dt>
            <dd>
              {detail.shippingCents > 0
                ? currency(detail.shippingCents / 100)
                : "A combinar"}
            </dd>
          </div>
          {detail.discountCents > 0 && (
            <div>
              <dt>Desconto</dt>
              <dd>-{currency(detail.discountCents / 100)}</dd>
            </div>
          )}
          <div className="is-total">
            <dt>Total</dt>
            <dd>{currency(detail.totalCents / 100)}</dd>
          </div>
        </dl>
      </section>

      <section className="order-detail-section" aria-label="Atualizar status">
        <h3>Gerenciar status</h3>
        {nextStatuses.length > 0 ? (
          <div className="order-transition-box">
            <FormField
              id="order-status-reason"
              label="Motivo da alteração (opcional)"
              placeholder="Ex.: Confirmação simulada em sandbox"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {isOverdue && (
              <p role="status" className="cell-sub">
                Prazo de pagamento expirado. Marque como Expirado ou Cancelado para liberar o estoque reservado.
              </p>
            )}
            {mutationError && <p role="alert">{mutationError}</p>}
            <div className="order-actions-row">
              {nextStatuses.map((target) => (
                <button
                  key={target}
                  type="button"
                  className="button button-secondary"
                  disabled={mutating || (isOverdue && target === "paid")}
                  onClick={() => void handleTransition(target)}
                >
                  Marcar como {ORDER_STATUS_LABEL[target]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="cell-sub">
            Pedido em estado final ({ORDER_STATUS_LABEL[detail.status]}). Nenhuma
            nova transição disponível.
          </p>
        )}
      </section>

      <section className="order-detail-section" aria-label="Histórico de status">
        <h3>Histórico de transições</h3>
        <ol className="order-history-list">
          {detail.history.map((entry) => (
            <li key={entry.id}>
              <div className="order-history-list__head">
                <strong>
                  {entry.fromStatus
                    ? `${ORDER_STATUS_LABEL[entry.fromStatus]} → ${ORDER_STATUS_LABEL[entry.toStatus]}`
                    : ORDER_STATUS_LABEL[entry.toStatus]}
                </strong>
                <span>{dateTimeFormat.format(new Date(entry.createdAt))}</span>
              </div>
              <p>{entry.reason}</p>
              <span className="cell-sub">
                Origem: {ACTOR_LABEL[entry.actorType] ?? entry.actorType}
                {entry.actorId ? ` · ${entry.actorId}` : ""}
                {typeof entry.metadata?.stockAction === "string" &&
                STOCK_ACTION_LABEL[entry.metadata.stockAction]
                  ? ` · ${STOCK_ACTION_LABEL[entry.metadata.stockAction]}`
                  : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function OrderDetailModal({
  orderId,
  onClose,
  onUpdated,
}: {
  orderId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const handleClose = () => {
    setOrderNumber(null);
    onClose();
  };

  const handleLoaded = useCallback((detail: OrderDetail) => {
    setOrderNumber(detail.orderNumber);
  }, []);

  return (
    <Modal
      open={Boolean(orderId)}
      onClose={handleClose}
      title={orderNumber ? `Pedido ${orderNumber}` : "Detalhes do pedido"}
      description="Visualização administrativa de itens, valores congelados, status e histórico de transições."
      className="order-modal"
    >
      {orderId && (
        <OrderDetailBody
          key={orderId}
          orderId={orderId}
          onLoaded={handleLoaded}
          onUpdated={onUpdated}
        />
      )}
    </Modal>
  );
}
