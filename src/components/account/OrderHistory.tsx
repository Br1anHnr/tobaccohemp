"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { demoOrders, orderStatusLabel } from "@/data/account-demo";
import { useCatalog } from "@/store/catalog-store";
import { useAccount } from "@/store/account-store";
import { currency } from "@/lib/currency";
import { formatDate, orderCount, orderSubtotal, orderTotal } from "@/lib/orders";
import { useCart } from "@/store/cart-store";
import { ORDER_STATUSES, type OrderStatus as RealOrderStatus } from "@/shared/contracts/orders";
import { ORDER_STATUS_LABEL, ORDER_STOCK_STATUS_LABEL } from "@/modules/orders/domain/order-status";
import type { CustomerOrderDetail } from "@/modules/orders";
import type { CustomerOrder, OrderStatus } from "@/types/account";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function OrderCard({ order }: { order: CustomerOrder }) {
  const products = useCatalog((s) => s.products);
  const add = useCart((s) => s.add);
  const available = order.items.filter(
    (item) => (products.find((p) => p.id === item.productId)?.stock ?? 0) > 0,
  );
  return (
    <article className="order-card">
      <header>
        <div>
          <p className="eyebrow">Pedido demonstrativo</p>
          <h3>{order.number}</h3>
          <p className="muted">
            {formatDate(order.createdAt)} · {orderCount(order)}{" "}
            {orderCount(order) === 1 ? "item" : "itens"}
          </p>
        </div>
        <span className={`status-badge status-${order.status}`}>
          {orderStatusLabel[order.status]}
        </span>
      </header>
      <details>
        <summary>Ver itens e valores</summary>
        <ul className="order-items">
          {order.items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            if (!product) return null;
            return (
              <li key={`${item.productId}:${item.variant ?? ""}`}>
                <Image src={product.image} alt="" width={56} height={56} />
                <span>
                  <Link href={`/produto/${product.slug}`}>{product.name}</Link>
                  <small>
                    {item.quantity} × {currency(product.price)}
                    {item.variant ? ` · ${item.variant}` : ""}
                  </small>
                </span>
                <b>{currency(product.price * item.quantity)}</b>
              </li>
            );
          })}
        </ul>
        <dl className="order-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{currency(orderSubtotal(order))}</dd>
          </div>
          <div>
            <dt>Entrega</dt>
            <dd>{order.shipping ? currency(order.shipping) : "A combinar"}</dd>
          </div>
          <div className="order-grand">
            <dt>Total</dt>
            <dd>{currency(orderTotal(order))}</dd>
          </div>
        </dl>
      </details>
      <footer>
        <strong>{currency(orderTotal(order))}</strong>
        <button
          type="button"
          className="button button-secondary"
          disabled={!available.length}
          onClick={() =>
            available.forEach((item) =>
              add(item.productId, item.quantity, item.variant),
            )
          }
        >
          <RotateCcw size={15} aria-hidden="true" /> Comprar novamente
        </button>
      </footer>
    </article>
  );
}

const realStatusClass: Record<RealOrderStatus, string> = {
  draft: "status-em-separacao",
  pending_payment: "status-em-separacao",
  paid: "status-entregue",
  expired: "status-cancelado",
  canceled: "status-cancelado",
  refunded: "status-cancelado",
};

export function RealOrderCard({ order }: { order: CustomerOrderDetail }) {
  const products = useCatalog((s) => s.products);
  const add = useCart((s) => s.add);
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const available = order.items.filter(
    (item) => (products.find((p) => p.id === item.productId)?.stock ?? 0) > 0,
  );

  return (
    <article className="order-card">
      <header>
        <div>
          <p className="eyebrow">
            {order.paymentProvider === "asaas"
              ? "Asaas Sandbox · teste sintético"
              : "Pedido demonstrativo"}
          </p>
          <h3>{order.orderNumber}</h3>
          <p className="muted">
            {dateTimeFormat.format(new Date(order.createdAt))} · {totalItems}{" "}
            {totalItems === 1 ? "item" : "itens"} ·{" "}
            {ORDER_STOCK_STATUS_LABEL[order.stockStatus ?? "none"]}
          </p>
        </div>
        <span className={`status-badge ${realStatusClass[order.status]}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </header>
      <details>
        <summary>Ver itens, valores e histórico</summary>
        <ul className="order-items">
          {order.items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return (
              <li key={item.id}>
                {product?.image ? (
                  <Image src={product.image} alt="" width={56} height={56} />
                ) : null}
                <span>
                  {product ? (
                    <Link href={`/produto/${product.slug}`}>{item.productName}</Link>
                  ) : (
                    <strong>{item.productName}</strong>
                  )}
                  <small>
                    {item.quantity} × {currency(item.unitPriceCents / 100)}
                    {item.variant ? ` · ${item.variant}` : ""}
                  </small>
                </span>
                <b>{currency(item.lineTotalCents / 100)}</b>
              </li>
            );
          })}
        </ul>
        <dl className="order-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{currency(order.subtotalCents / 100)}</dd>
          </div>
          <div>
            <dt>Entrega</dt>
            <dd>
              {order.shippingCents > 0
                ? currency(order.shippingCents / 100)
                : "A combinar"}
            </dd>
          </div>
          <div className="order-grand">
            <dt>Total</dt>
            <dd>{currency(order.totalCents / 100)}</dd>
          </div>
        </dl>
        {order.history.length > 0 && (
          <ul className="confirmation-history">
            {order.history.map((entry) => (
              <li key={entry.id}>
                <strong>
                  {ORDER_STATUS_LABEL[entry.toStatus]} ·{" "}
                  {dateTimeFormat.format(new Date(entry.createdAt))}
                </strong>
                <span>{entry.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </details>
      <footer>
        <strong>{currency(order.totalCents / 100)}</strong>
        <div className="account-gate-actions">
          {order.paymentProvider === "asaas" && (
            <Link
              href={`/checkout?asaasOrder=${encodeURIComponent(order.id)}`}
              className="text-link"
            >
              Consultar no checkout
            </Link>
          )}
          <button
            type="button"
            className="button button-secondary"
            disabled={!available.length}
            onClick={() =>
              available.forEach((item) =>
                add(item.productId, item.quantity, item.variant || undefined),
              )
            }
          >
            <RotateCcw size={15} aria-hidden="true" /> Comprar novamente
          </button>
        </div>
      </footer>
    </article>
  );
}

export async function fetchCustomerOrdersClient(): Promise<CustomerOrderDetail[]> {
  try {
    const response = await fetch("/api/auth/orders", { cache: "no-store" });
    if (!response.ok) return [];
    const body = await response.json().catch(() => null);
    return Array.isArray(body?.data) ? (body.data as CustomerOrderDetail[]) : [];
  } catch {
    return [];
  }
}

export function OrderHistory() {
  const customer = useAccount((s) => s.customer);
  const [demoStatus, setDemoStatus] = useState<OrderStatus | "">("");
  const [realStatus, setRealStatus] = useState<RealOrderStatus | "">("");
  const [loadedState, setLoadedState] = useState<{
    email: string | null;
    orders: CustomerOrderDetail[];
  }>({ email: null, orders: [] });

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    void fetchCustomerOrdersClient().then((rows) => {
      if (!cancelled) {
        setLoadedState({ email: customer.email, orders: rows });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  const loading = Boolean(customer) && loadedState.email !== customer?.email;
  const realOrders = loadedState.email === customer?.email ? loadedState.orders : [];

  if (!customer) {
    const visible = demoOrders.filter((o) => !demoStatus || o.status === demoStatus);
    return (
      <section className="account-section" aria-labelledby="orders-title">
        <div className="account-section-head">
          <h2 id="orders-title">Histórico de pedidos</h2>
          <label className="status-filter">
            Status
            <select
              value={demoStatus}
              onChange={(e) => setDemoStatus(e.target.value as OrderStatus | "")}
            >
              <option value="">Todos</option>
              {Object.entries(orderStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted" role="status">
          {visible.length} {visible.length === 1 ? "pedido" : "pedidos"}
        </p>
        {visible.length ? (
          <div className="order-list">
            {visible.map((order) => (
              <OrderCard key={order.number} order={order} />
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <h3>Nenhum pedido com este status.</h3>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setDemoStatus("")}
            >
              Ver todos os pedidos
            </button>
          </div>
        )}
      </section>
    );
  }

  const visibleReal = realOrders.filter((o) => !realStatus || o.status === realStatus);

  return (
    <section className="account-section" aria-labelledby="orders-title">
      <div className="account-section-head">
        <h2 id="orders-title">Histórico de pedidos</h2>
        <label className="status-filter">
          Status
          <select
            value={realStatus}
            onChange={(e) => setRealStatus(e.target.value as RealOrderStatus | "")}
          >
            <option value="">Todos</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ORDER_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted" role="status">
        {loading
          ? "Carregando seus pedidos…"
          : `${visibleReal.length} ${visibleReal.length === 1 ? "pedido" : "pedidos"}`}
      </p>
      {!loading && visibleReal.length > 0 && (
        <div className="order-list">
          {visibleReal.map((order) => (
            <RealOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
      {!loading && visibleReal.length === 0 && (
        <div className="empty-state compact">
          <h3>
            {realStatus
              ? "Nenhum pedido com este status."
              : "Você ainda não possui pedidos registrados nesta conta."}
          </h3>
          {realStatus ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setRealStatus("")}
            >
              Ver todos os pedidos
            </button>
          ) : (
            <Link href="/loja" className="button button-secondary">
              Explorar a loja
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
