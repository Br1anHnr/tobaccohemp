"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { demoOrders, orderStatusLabel } from "@/data/account-demo";
import { findProduct } from "@/data/products";
import { currency } from "@/lib/currency";
import { formatDate, orderCount, orderSubtotal, orderTotal } from "@/lib/orders";
import { useCart } from "@/store/cart-store";
import type { CustomerOrder, OrderStatus } from "@/types/account";

export function OrderCard({ order }: { order: CustomerOrder }) {
  const add = useCart((s) => s.add);
  const available = order.items.filter(
    (item) => (findProduct(item.productId)?.stock ?? 0) > 0,
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
            const product = findProduct(item.productId);
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

export function OrderHistory() {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const visible = demoOrders.filter((o) => !status || o.status === status);
  return (
    <section className="account-section" aria-labelledby="orders-title">
      <div className="account-section-head">
        <h2 id="orders-title">Histórico de pedidos</h2>
        <label className="status-filter">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus | "")}
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
            onClick={() => setStatus("")}
          >
            Ver todos os pedidos
          </button>
        </div>
      )}
    </section>
  );
}
