"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ArrowUpRight } from "lucide-react";
import { products } from "@/data/products";
import { normalize } from "@/lib/utils";
import { currency } from "@/lib/currency";
import { useCart } from "@/store/cart-store";
import { Modal } from "@/components/ui/Modal";
export function SearchOverlay() {
  const overlay = useCart((s) => s.overlay);
  const open = useCart((s) => s.setOverlay);
  const [query, setQuery] = useState("");
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
  const results = products
    .filter((p) =>
      normalize([p.name, p.brand, p.category, ...p.tags].join(" ")).includes(
        normalize(query.trim()),
      ),
    )
    .slice(0, 8);
  return (
    <Modal
      open={overlay === "search"}
      onClose={() => open(null)}
      title="Encontre seu próximo essencial"
      description="Busque por produto, categoria ou coleção."
      className="search-modal"
    >
      <label className="search-field">
        <Search size={20} />
        <span className="sr-only">Buscar produtos</span>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="O que você procura?"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              list.current?.querySelector<HTMLAnchorElement>("a")?.focus();
            }
          }}
        />
      </label>
      <p className="search-count" role="status">
        {query ? `${results.length} resultados` : "Explore nossa seleção"}
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
            <Image src={p.image} alt="" width={64} height={64} />
            <span>
              <strong>{p.name}</strong>
              <small>{p.category}</small>
            </span>
            <b>{currency(p.price)}</b>
            <ArrowUpRight size={17} />
          </Link>
        ))}
        {!results.length && (
          <p className="search-empty">
            Nenhum produto encontrado. Tente “case”, “bolsa” ou “bandeja”.
          </p>
        )}
      </div>
    </Modal>
  );
}
