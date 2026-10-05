"use client";
import { currency } from "@/lib/currency";
import { cartTotal, useCart } from "@/store/cart-store";
import { ButtonLink } from "@/components/ui/Button";
export function CartSummary({ checkout = false }: { checkout?: boolean }) {
  const items = useCart((s) => s.items);
  return (
    <div className="cart-summary">
      <p>
        <span>Subtotal</span>
        <strong>{currency(cartTotal(items))}</strong>
      </p>
      <p>
        <span>Entrega</span>
        <span>A combinar</span>
      </p>
      <div className="summary-total">
        <span>Total dos produtos</span>
        <strong>{currency(cartTotal(items))}</strong>
      </div>
      {!checkout && (
        <ButtonLink href="/checkout" className="w-full">
          Finalizar pedido
        </ButtonLink>
      )}
      <small>Preços demonstrativos. A entrega não está incluída.</small>
    </div>
  );
}
