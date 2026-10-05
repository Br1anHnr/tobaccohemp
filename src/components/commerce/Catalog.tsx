"use client";
import { startTransition, useMemo, useOptimistic, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { products } from "@/data/products";
import { categories } from "@/data/categories";
import { currency } from "@/lib/currency";
import { ProductGrid } from "./ProductGrid";
const brands = [...new Set(products.map((p) => p.brand))];
export function Catalog({ categorySlug }: { categorySlug?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [optimisticQuery, setOptimisticQuery] = useOptimistic(
    searchParams.toString(),
  );
  const params = new URLSearchParams(optimisticQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const category = categorySlug ?? params.get("categoria") ?? "";
  const brand = params.get("marca") ?? "";
  const onlyNew = params.get("novidades") === "1";
  const sort = params.get("ordem") ?? "destaques";
  const requestedMax = Number(params.get("preco") ?? 200);
  const maxPrice = Number.isFinite(requestedMax)
    ? Math.max(0, Math.min(200, requestedMax))
    : 200;
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      setOptimisticQuery(next.toString());
      router.replace(
        `${categorySlug ? `/categoria/${categorySlug}` : "/loja"}${next.size ? `?${next.toString()}` : ""}`,
        { scroll: false },
      );
    });
  };
  const visible = useMemo(
    () =>
      products
        .filter(
          (p) =>
            (!category || p.categorySlug === category) &&
            (!brand || p.brand === brand) &&
            (!onlyNew || p.isNew) &&
            p.price <= maxPrice,
        )
        .sort((a, b) =>
          sort === "menor"
            ? a.price - b.price
            : sort === "maior"
              ? b.price - a.price
              : sort === "novidades"
                ? Number(b.isNew) - Number(a.isNew)
                : Number(b.isFeatured) - Number(a.isFeatured),
        ),
    [category, brand, onlyNew, maxPrice, sort],
  );
  return (
    <div className="catalog">
      <div className="catalog-toolbar">
        <span role="status">
          {visible.length} {visible.length === 1 ? "produto" : "produtos"}
        </span>
        <button
          className="filter-toggle button button-secondary"
          aria-expanded={filtersOpen}
          aria-controls="catalog-filters"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={16} /> Filtros
        </button>
        <label className="sort-label">
          Ordenar por{" "}
          <select
            aria-label="Ordenar por"
            value={sort}
            onChange={(e) => change("ordem", e.target.value)}
          >
            <option value="destaques">Destaques</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
            <option value="novidades">Novidades</option>
          </select>
        </label>
      </div>
      <div className="catalog-layout">
        <aside
          id="catalog-filters"
          className={`filters ${filtersOpen ? "is-open" : ""}`}
        >
          <h2>
            <SlidersHorizontal size={17} /> Filtrar seleção
          </h2>
          {!categorySlug && (
            <label>
              Categoria
              <select
                aria-label="Categoria"
                value={category}
                onChange={(e) => change("categoria", e.target.value)}
              >
                <option value="">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Coleção
            <select
              aria-label="Coleção"
              value={brand}
              onChange={(e) => change("marca", e.target.value)}
            >
              <option value="">Todas as coleções</option>
              {brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyNew}
              onChange={(e) => change("novidades", e.target.checked ? "1" : "")}
            />{" "}
            Apenas novidades
          </label>
          <label>
            Até {currency(maxPrice)}
            <input
              type="range"
              min="0"
              max="200"
              step="5"
              value={maxPrice}
              onChange={(e) => change("preco", e.target.value)}
            />
          </label>
          <button
            className="text-link"
            onClick={() =>
              router.replace(
                categorySlug ? `/categoria/${categorySlug}` : "/loja",
                { scroll: false },
              )
            }
          >
            <X size={14} /> Limpar filtros
          </button>
        </aside>
        <div>
          {visible.length ? (
            <ProductGrid products={visible} />
          ) : (
            <div className="empty-state compact">
              <h2>Nenhum produto nesta seleção.</h2>
              <p>Experimente outra categoria ou ajuste os filtros.</p>
              <button
                className="button button-secondary"
                onClick={() =>
                  router.replace(
                    categorySlug ? `/categoria/${categorySlug}` : "/loja",
                    { scroll: false },
                  )
                }
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
