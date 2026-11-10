"use client";
import Link from "next/link";
import { ArrowRight, Heart, Package, ShoppingBag } from "lucide-react";
import { demoOrders } from "@/data/account-demo";
import { cartCount, useCart } from "@/store/cart-store";
import { useAccount } from "@/store/account-store";
import { OrderCard } from "./OrderHistory";

export function AccountOverview() {
  const profile = useAccount((s) => s.profile);
  const items = useCart((s) => s.items);
  const favorites = useCart((s) => s.favorites);
  const open = useCart((s) => s.setOverlay);
  const latest = demoOrders[0];
  return (
    <>
      <section className="account-stats" aria-label="Resumo da conta">
        <Link href="/conta/pedidos" className="stat-card">
          <Package size={20} aria-hidden="true" />
          <strong>{demoOrders.length}</strong>
          <span>Pedidos demonstrativos</span>
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
        {latest && <OrderCard order={latest} />}
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
            <dd>{profile.phone}</dd>
          </div>
          <div>
            <dt>Cidade</dt>
            <dd>
              {profile.city} / {profile.state}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
