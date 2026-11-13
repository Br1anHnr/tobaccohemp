"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Heart, UserRound } from "lucide-react";
import { navigation } from "@/data/navigation";
import { useCatalog } from "@/store/catalog-store";
import { useCart } from "@/store/cart-store";
import { Modal } from "@/components/ui/Modal";
export function MobileMenu() {
  const pathname = usePathname();
  const overlay = useCart((s) => s.overlay);
  const close = useCart((s) => s.setOverlay);
  const categories = useCatalog((s) => s.categories);
  return (
    <Modal
      open={overlay === "menu"}
      onClose={() => close(null)}
      title="Explore a loja"
      description="Seu estilo começa aqui."
      drawer
      className="mobile-menu"
    >
      <nav aria-label="Menu mobile">
        {navigation.map((item) => {
          const active =
            item.href === "/categorias"
              ? pathname === "/categorias" || pathname.startsWith("/categoria/")
              : pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => close(null)}
            >
              {item.label}
              <ArrowUpRight size={24} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
      <div className="mobile-menu-links">
        <Link href="/conta" className="menu-account" onClick={() => close(null)}>
          <UserRound size={18} aria-hidden="true" /> Minha conta
        </Link>
        <Link
          href="/favoritos"
          className="menu-account"
          onClick={() => close(null)}
        >
          <Heart size={18} aria-hidden="true" /> Favoritos
        </Link>
      </div>
      <p className="eyebrow">Por categoria</p>
      <div className="menu-categories">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/categoria/${c.slug}`}
            aria-current={
              pathname === `/categoria/${c.slug}` ? "page" : undefined
            }
            onClick={() => close(null)}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </Modal>
  );
}
