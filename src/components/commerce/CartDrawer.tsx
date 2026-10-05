"use client";
import Link from "next/link";
import { useCart, cartTotal, cartCount } from "@/store/cart-store";
import { currency } from "@/lib/currency";
import { itemKey } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { CartItem } from "./CartItem";
export function CartDrawer() {
  const items = useCart((s) => s.items);
  const overlay = useCart((s) => s.overlay);
  const close = useCart((s) => s.setOverlay);
  return (
    <Modal
      open={overlay === "cart"}
      onClose={() => close(null)}
      title="Seu carrinho"
      description={`${cartCount(items)} ${cartCount(items) === 1 ? "item escolhido" : "itens escolhidos"}. Bom estilo começa nos detalhes.`}
      drawer
      className="cart-drawer"
    >
      {items.length ? (
        <>
          <div className="drawer-items">
            {items.map((item) => (
              <CartItem
                key={itemKey(item.productId, item.variant)}
                item={item}
              />
            ))}
          </div>
          <div className="drawer-bottom">
            <p>
              <span>Subtotal</span>
              <strong>{currency(cartTotal(items))}</strong>
            </p>
            <small>Entrega a combinar no checkout demonstrativo.</small>
            <Link
              href="/checkout"
              className="button button-primary w-full"
              onClick={() => close(null)}
            >
              Finalizar pedido →
            </Link>
            <Link
              href="/carrinho"
              className="button button-secondary w-full"
              onClick={() => close(null)}
            >
              Ver carrinho
            </Link>
          </div>
        </>
      ) : (
        <div
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) close(null);
          }}
        >
          <EmptyState compact />
        </div>
      )}
    </Modal>
  );
}
