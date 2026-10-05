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
  const [image, setImage] = useState(product.image);
  const gallery = product.gallery ?? [product.image];
  return (
    <div className="product-detail">
      <div className="product-gallery">
        <div className="gallery-main">
          <Image
            src={image}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 767px) 100vw, 50vw"
          />
          {product.isNew && <span className="badge">Novo na seleção</span>}
        </div>
        <div className="gallery-thumbs">
          {gallery.map((src, index) => (
            <button
              key={src}
              aria-label={`Ver imagem ${index + 1} de ${product.name}`}
              aria-pressed={image === src}
              onClick={() => setImage(src)}
            >
              <Image src={src} alt="" width={90} height={90} />
            </button>
          ))}
        </div>
        <small>
          Imagem ilustrativa. A aparência e as variações do produto devem ser
          confirmadas com a loja.
        </small>
      </div>
      <div className="product-description">
        <p className="eyebrow">
          {product.brand} / {product.category}
        </p>
        <h1>{product.name}</h1>
        <Price price={product.price} compareAtPrice={product.compareAtPrice} />
        <p>{product.description}</p>
        {product.variants && (
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
                  {variant === v && <Check size={14} />}
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
        <p className="product-note">
          <Package size={16} /> Entrega a combinar. Preço demonstrativo.
        </p>
        <details open>
          <summary>Sobre este essencial</summary>
          <p>{product.description}</p>
        </details>
        <details>
          <summary>Informações da seleção</summary>
          <p>
            Categoria: {product.category}. Coleção: {product.brand}. Os
            produtos, imagens, preços e quantidades desta versão são
            demonstrativos.
          </p>
        </details>
      </div>
    </div>
  );
}
