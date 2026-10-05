"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { navigation } from "@/data/navigation";
import { categories } from "@/data/categories";
import { useCart } from "@/store/cart-store";
import { Modal } from "@/components/ui/Modal";
export function MobileMenu() {
  const overlay = useCart((s) => s.overlay);
  const close = useCart((s) => s.setOverlay);
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
        {navigation.map((item) => (
          <Link key={item.label} href={item.href} onClick={() => close(null)}>
            {item.label}
            <ArrowUpRight size={24} />
          </Link>
        ))}
      </nav>
      <p className="eyebrow">Por categoria</p>
      <div className="menu-categories">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/categoria/${c.slug}`}
            onClick={() => close(null)}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </Modal>
  );
}
