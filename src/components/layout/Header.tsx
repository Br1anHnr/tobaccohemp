"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, UserRound, ShoppingBag, Menu } from "lucide-react";
import { navigation } from "@/data/navigation";
import { cartCount, useCart } from "@/store/cart-store";
import { useAccount } from "@/store/account-store";
import { Container } from "./Container";
import { Logo } from "./Logo";
export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.setOverlay);
  const customer = useAccount((s) => s.customer);
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
          {navigation.map((item) => {
            const active =
              item.href === "/categorias"
                ? pathname === "/categorias" ||
                  pathname.startsWith("/categoria/")
                : pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                prefetch={item.href === "/" ? undefined : false}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="header-actions">
          <button
            className="header-search"
            onClick={() => open("search")}
            aria-label="Buscar produtos"
          >
            <Search size={20} aria-hidden="true" />
            <span>O que você procura?</span>
            <kbd>/</kbd>
          </button>
          <button
            className={`icon-button account-button ${customer ? "is-authenticated" : ""}`}
            onClick={() => open("account")}
            aria-label="Minha conta"
            data-authenticated={customer ? "true" : "false"}
          >
            <UserRound size={21} aria-hidden="true" />
            {customer && <span className="account-dot" aria-hidden="true" />}
          </button>
          <button
            className="icon-button cart-trigger"
            onClick={() => open("cart")}
            aria-label={`Abrir carrinho, ${cartCount(items)} ${cartCount(items) === 1 ? "item" : "itens"}`}
          >
            <ShoppingBag size={22} aria-hidden="true" />
            <span className="cart-badge">{cartCount(items)}</span>
          </button>
          <button
            className="icon-button menu-trigger"
            onClick={() => open("menu")}
            aria-label="Abrir menu"
          >
            <Menu size={23} aria-hidden="true" />
          </button>
        </div>
      </Container>
    </header>
  );
}
