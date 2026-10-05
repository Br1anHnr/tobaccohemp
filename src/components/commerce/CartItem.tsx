"use client";
import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { CartItem as Item } from "@/types/cart";
import { findProduct } from "@/data/products";
import { useCart } from "@/store/cart-store";
import { currency } from "@/lib/currency";
import { QuantitySelector } from "./QuantitySelector";
export function CartItem({ item }: { item: Item }) {
  const product = findProduct(item.productId);
  const update = useCart((s) => s.quantity);
  const remove = useCart((s) => s.remove);
  const close = useCart((s) => s.setOverlay);
  const items = useCart((s) => s.items);
  if (!product) return null;
  const otherCount = items
    .filter((i) => i.productId === item.productId && i.variant !== item.variant)
    .reduce((sum, i) => sum + i.quantity, 0);
  return (
    <div className="cart-item">
      <Link
        href={`/produto/${product.slug}`}
        onClick={() => close(null)}
        className="cart-thumb"
      >
        <Image src={product.image} alt={product.name} fill sizes="96px" />
      </Link>
      <div className="cart-item-info">
        <Link href={`/produto/${product.slug}`} onClick={() => close(null)}>
          {product.name}
        </Link>
        {item.variant && <p>{item.variant}</p>}
        <QuantitySelector
          value={item.quantity}
          onChange={(value) => update(item.productId, item.variant, value)}
          max={product.stock - otherCount}
          label={product.name}
        />
      </div>
      <div className="cart-item-end">
        <strong>{currency(product.price * item.quantity)}</strong>
        <button
          className="icon-button"
          aria-label={`Remover ${product.name} do carrinho`}
          onClick={() => remove(item.productId, item.variant)}
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  );
}
