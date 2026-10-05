"use client";
import { ShoppingBag, Plus } from "lucide-react";
import { useCart } from "@/store/cart-store";
import type { Product } from "@/types/product";
export function AddToCartButton({
  product,
  quantity = 1,
  variant,
  compact = false,
}: {
  product: Product;
  quantity?: number;
  variant?: string;
  compact?: boolean;
}) {
  const add = useCart((s) => s.add);
  return (
    <button
      type="button"
      disabled={!product.stock}
      onClick={() =>
        add(product.id, quantity, variant ?? product.variants?.[0])
      }
      className={compact ? "add-compact" : "button button-primary add-full"}
      aria-label={`Adicionar ${product.name} ao carrinho`}
    >
      {compact ? (
        <Plus size={19} />
      ) : (
        <>
          <ShoppingBag size={18} />
          {product.stock ? "Adicionar ao carrinho" : "Indisponível"}
        </>
      )}
    </button>
  );
}
