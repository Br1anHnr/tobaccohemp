"use client";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { Product } from "@/types/product";
import { useCart } from "@/store/cart-store";
import { Price } from "./Price";
import { AddToCartButton } from "./AddToCartButton";
export function ProductCard({ product }: { product: Product }) {
  const favorites = useCart((s) => s.favorites);
  const toggle = useCart((s) => s.toggleFavorite);
  const favorite = favorites.includes(product.id);
  return (
    <article className="product-card">
      <div className="product-media">
        <Link
          href={`/produto/${product.slug}`}
          aria-label={`Ver ${product.name}`}
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 767px) 46vw, (max-width: 1100px) 30vw, 23vw"
          />
        </Link>
        {product.isNew && <span className="badge">Novo</span>}
        <button
          className={`favorite-button ${favorite ? "selected" : ""}`}
          aria-label={`${favorite ? "Remover" : "Adicionar"} ${product.name} ${favorite ? "dos" : "aos"} favoritos`}
          aria-pressed={favorite}
          onClick={() => toggle(product.id)}
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <p>{product.category}</p>
        <Link href={`/produto/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <div className="product-bottom">
          <Price
            price={product.price}
            compareAtPrice={product.compareAtPrice}
          />
          <AddToCartButton product={product} compact />
        </div>
      </div>
    </article>
  );
}
