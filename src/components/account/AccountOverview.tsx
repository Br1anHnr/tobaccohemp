"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, Package, ShoppingBag } from "lucide-react";
import { demoOrders } from "@/data/account-demo";
import { formatPhone, formatZip } from "@/lib/auth";
import { cartCount, useCart } from "@/store/cart-store";
import { useAccount } from "@/store/account-store";
import type { CustomerOrderDetail } from "@/modules/orders";
import { fetchCustomerOrdersClient, OrderCard, RealOrderCard } from "./OrderHistory";

export function AccountOverview() {
  const customer = useAccount((s) => s.customer);
  const profile = useAccount((s) => s.profile);
  const items = useCart((s) => s.items);
  const favorites = useCart((s) => s.favorites);
  const open = useCart((s) => s.setOverlay);
  const [realOrders, setRealOrders] = useState<CustomerOrderDetail[]>([]);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    void fetchCustomerOrdersClient().then((rows) => {
      if (!cancelled) setRealOrders(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  const latestDemo = demoOrders[0];
  const latestReal = realOrders[0] ?? null;
  const orderTotalCount = customer ? realOrders.length : demoOrders.length;
  const primaryAddress =
    profile.addresses?.find((address) => address.isDefault) ??
    profile.addresses?.[0] ??
    null;

  return (
    <>
      <section className="account-stats" aria-label="Resumo da conta">
        <Link href="/conta/pedidos" className="stat-card">
          <Package size={20} aria-hidden="true" />
          <strong>{orderTotalCount}</strong>
          <span>{customer ? "Pedidos registrados" : "Pedidos demonstrativos"}</span>
        </Link>
        <Link href="/favoritos" className="stat-card">
          <Heart size={20} aria-hidden="true" />
          <strong>{favorites.length}</strong>
          <span>Favoritos neste dispositivo</span>
        </Link>
        <button type="button" className="stat-card" onClick={() => open("cart")}>
          <ShoppingBag size={20} aria-hidden="true" />
          <strong>{cartCount(items)}</strong>
          <span>Itens no carrinho</span>
        </button>
      </section>
      <section className="account-section" aria-labelledby="latest-title">
        <div className="account-section-head">
          <h2 id="latest-title">Último pedido</h2>
          <Link href="/conta/pedidos" className="text-link">
            Ver histórico <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        {customer ? (
          latestReal ? (
            <RealOrderCard order={latestReal} />
          ) : (
            <p className="muted">Nenhum pedido registrado nesta conta até o momento.</p>
          )
        ) : (
          latestDemo && <OrderCard order={latestDemo} />
        )}
      </section>
      <section className="account-section" aria-labelledby="profile-title">
        <div className="account-section-head">
          <h2 id="profile-title">Dados cadastrais</h2>
          <Link href="/conta/perfil" className="text-link">
            Editar <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <dl className="profile-summary">
          <div>
            <dt>Nome</dt>
            <dd>{profile.name}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{profile.email}</dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>{profile.phone ? formatPhone(profile.phone) : "Não informado"}</dd>
          </div>
          <div>
            <dt>Cidade</dt>
            <dd>
              {profile.city || profile.state
                ? `${profile.city}${profile.city && profile.state ? " / " : ""}${profile.state}`
                : "Não informada"}
            </dd>
          </div>
          {primaryAddress && (
            <div className="profile-summary-wide">
              <dt>Endereço principal</dt>
              <dd>
                {primaryAddress.street}, {primaryAddress.number}
                {primaryAddress.complement ? ` — ${primaryAddress.complement}` : ""} ·{" "}
                {primaryAddress.city}/{primaryAddress.state} · CEP{" "}
                {formatZip(primaryAddress.zip)}
              </dd>
            </div>
          )}
        </dl>
      </section>
    </>
  );
}
