"use client";
import { useState } from "react";
import Image from "next/image";
import { Check, Package } from "lucide-react";
import type { Product } from "@/types/product";
import { Price } from "./Price";
import { QuantitySelector } from "./QuantitySelector";
import { AddToCartButton } from "./AddToCartButton";
export function ProductDetails({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState(product.variants?.[0]);
  const gallery = product.gallery?.length ? product.gallery : product.image ? [product.image] : [];
  const [image, setImage] = useState(gallery[0] ?? "");
  const activeImage = image || gallery[0] || "";
  return (
    <div className="product-detail">
      <div className="product-gallery">
        <div className="gallery-main">
          {activeImage ? (
            <Image
              src={activeImage}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 767px) 100vw, 50vw"
            />
          ) : (
            <div className="media-placeholder media-placeholder--pdp" aria-hidden="true">
              <Package size={44} strokeWidth={1.3} />
              <span>Produto sem foto</span>
            </div>
          )}
          {product.isNew && <span className="badge">Novo na seleção</span>}
        </div>
        {gallery.length > 1 && (
          <div className="gallery-thumbs">
            {gallery.map((src, index) => (
              <button
                key={src}
                type="button"
                aria-label={`Ver imagem ${index + 1} de ${product.name}`}
                aria-pressed={activeImage === src}
                onClick={() => setImage(src)}
              >
                <Image src={src} alt="" width={90} height={90} sizes="90px" />
              </button>
            ))}
          </div>
        )}
        <small>
          Imagens de referência. Consulte variações disponíveis.
        </small>
      </div>
      <div className="product-description">
        <p className="eyebrow">
          {product.brand} / {product.category}
        </p>
        <h1>{product.name}</h1>
        <Price price={product.price} compareAtPrice={product.compareAtPrice} />
        <p>{product.description}</p>
        {product.variants && product.variants.length > 0 && (
          <fieldset className="variant-fieldset">
            <legend>Variação: {variant}</legend>
            <div>
              {product.variants.map((v) => (
                <label className={variant === v ? "active" : ""} key={v}>
                  <input
                    type="radio"
                    name="variant"
                    value={v}
                    checked={variant === v}
                    onChange={() => setVariant(v)}
                  />
                  <span>{v}</span>
                  {variant === v && <Check size={14} aria-hidden="true" />}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="product-buy">
          <QuantitySelector
            value={quantity}
            onChange={setQuantity}
            max={product.stock}
            label={product.name}
          />
          <AddToCartButton
            product={product}
            quantity={quantity}
            variant={variant}
          />
        </div>
        {quantity >= product.stock && product.stock > 0 && (
          <small className="stock-limit">
            Limite de {product.stock} unidades disponíveis nesta seleção.
          </small>
        )}
        <p className="product-note">
          <Package size={16} aria-hidden="true" /> Entrega a combinar.
        </p>
        <details open>
          <summary>Sobre este essencial</summary>
          <p>{product.description}</p>
        </details>
        <details>
          <summary>Informações da seleção</summary>
          <p>
            Categoria: {product.category}. Coleção: {product.brand}.
          </p>
        </details>
      </div>
    </div>
  );
}
