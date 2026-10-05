"use client";
import { useCart } from "@/store/cart-store";
import { products } from "@/data/products";
import { ProductGrid } from "./ProductGrid";
import { EmptyState } from "@/components/ui/EmptyState";
export function Favorites() {
  const ids = useCart((s) => s.favorites);
  const selected = products.filter((p) => ids.includes(p.id));
  return selected.length ? (
    <ProductGrid products={selected} />
  ) : (
    <EmptyState
      title="Uma seleção com a sua cara."
      text="Toque no coração de um produto para guardá-lo nos favoritos."
    />
  );
}
