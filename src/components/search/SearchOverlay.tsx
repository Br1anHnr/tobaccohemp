"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight, Package, X } from "lucide-react";
import { useCatalog } from "@/store/catalog-store";
import { normalize } from "@/lib/utils";
import { currency } from "@/lib/currency";
import { useCart } from "@/store/cart-store";
import { Modal } from "@/components/ui/Modal";
const suggestions = ["Case", "Bolsa", "Bandeja", "Organizador", "Kit"];
export function SearchOverlay() {
  const router = useRouter();
  const overlay = useCart((s) => s.overlay);
  const open = useCart((s) => s.setOverlay);
  const products = useCatalog((s) => s.products);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
        !target.isContentEditable &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        open("search");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  const trimmed = query.trim();
  const allMatches = products.filter((p) =>
    normalize([p.name, p.brand, p.category, ...p.tags].join(" ")).includes(
      normalize(trimmed),
    ),
  );
  const results = allMatches.slice(0, 8);
  return (
    <Modal
      open={overlay === "search"}
      onClose={() => open(null)}
      title="Encontre seu próximo essencial"
      description="Busque por produto, categoria ou coleção."
      className="search-modal"
    >
      <label className="search-field">
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">Buscar produtos</span>
        <input
          ref={inputRef}
          autoFocus
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="O que você procura?"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              list.current?.querySelector<HTMLAnchorElement>("a")?.focus();
            } else if (e.key === "Enter" && trimmed) {
              e.preventDefault();
              open(null);
              router.push(`/loja?q=${encodeURIComponent(trimmed)}`);
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label="Limpar busca"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </label>
      {!trimmed && (
        <div className="search-suggestions" aria-label="Sugestões de busca">
          {suggestions.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => {
                setQuery(term);
                inputRef.current?.focus();
              }}
            >
              {term}
            </button>
          ))}
        </div>
      )}
      <p className="search-count" role="status">
        {trimmed
          ? allMatches.length > results.length
            ? `Mostrando ${results.length} de ${allMatches.length} resultados`
            : `${allMatches.length} ${allMatches.length === 1 ? "resultado" : "resultados"}`
          : "Explore nossa seleção"}
      </p>
      <div
        className="search-results"
        ref={list}
        onKeyDown={(e) => {
          if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
          const links = Array.from(list.current?.querySelectorAll("a") ?? []);
          const index = links.indexOf(
            document.activeElement as HTMLAnchorElement,
          );
          if (index >= 0) {
            e.preventDefault();
            links[
              (index + (e.key === "ArrowDown" ? 1 : -1) + links.length) %
                links.length
            ]?.focus();
          }
        }}
      >
        {results.map((p) => (
          <Link
            key={p.id}
            href={`/produto/${p.slug}`}
            onClick={() => open(null)}
          >
            {p.image ? (
              <Image src={p.image} alt="" width={64} height={64} sizes="64px" />
            ) : (
              <div className="media-placeholder media-placeholder--search" aria-hidden="true">
                <Package size={18} strokeWidth={1.4} />
              </div>
            )}
            <span>
              <strong>{p.name}</strong>
              <small>{p.category}</small>
            </span>
            <b>{currency(p.price)}</b>
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        ))}
        {!results.length && (
          <p className="search-empty">
            Nenhum produto encontrado. Tente “case”, “bolsa” ou “bandeja”.
          </p>
        )}
      </div>
      {trimmed && allMatches.length > 0 && (
        <Link
          className="text-link search-all"
          href={`/loja?q=${encodeURIComponent(trimmed)}`}
          onClick={() => open(null)}
        >
          Ver todos os resultados na loja <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      )}
    </Modal>
  );
}
