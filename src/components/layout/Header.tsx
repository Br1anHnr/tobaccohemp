"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, UserRound, ShoppingBag, Menu } from "lucide-react";
import { navigation } from "@/data/navigation";
import { cartCount, useCart } from "@/store/cart-store";
import { Container } from "./Container";
import { Logo } from "./Logo";
export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.setOverlay);
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 30);
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, []);
  return (
    <header className={`header ${scrolled ? "scrolled" : ""}`}>
      <Container>
        <Link href="/" aria-label="Tobacco Hemp — início" className="logo-link">
          <Logo />
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="header-search"
            onClick={() => open("search")}
            aria-label="Buscar produtos"
          >
            <Search size={20} />
            <span>O que você procura?</span>
            <kbd>/</kbd>
          </button>
          <button
            className="icon-button account-button"
            onClick={() => open("account")}
            aria-label="Minha conta"
          >
            <UserRound size={21} />
          </button>
          <button
            className="icon-button cart-trigger"
            onClick={() => open("cart")}
            aria-label={`Abrir carrinho, ${cartCount(items)} ${cartCount(items) === 1 ? "item" : "itens"}`}
          >
            <ShoppingBag size={22} />
            <span className="cart-badge">{cartCount(items)}</span>
          </button>
          <button
            className="icon-button menu-trigger"
            onClick={() => open("menu")}
            aria-label="Abrir menu"
          >
            <Menu size={23} />
          </button>
        </div>
      </Container>
    </header>
  );
}
