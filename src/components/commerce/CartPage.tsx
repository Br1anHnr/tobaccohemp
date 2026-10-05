"use client";
import { useCart, cartCount } from "@/store/cart-store";
import { itemKey } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { CartItem } from "./CartItem";
import { CartSummary } from "./CartSummary";
export function CartPage() {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  if (!hydrated) return <p role="status">Carregando seu carrinho…</p>;
  if (!items.length) return <EmptyState />;
  return (
    <div className="commerce-columns">
      <section aria-label="Itens do carrinho">
        <p className="eyebrow">{cartCount(items)} itens na sua seleção</p>
        {items.map((item) => (
          <CartItem key={itemKey(item.productId, item.variant)} item={item} />
        ))}
      </section>
      <aside className="summary-panel">
        <h2>Resumo do pedido</h2>
        <CartSummary />
      </aside>
    </div>
  );
}
