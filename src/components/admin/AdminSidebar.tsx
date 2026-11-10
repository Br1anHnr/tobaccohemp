"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import { Logo } from "@/components/layout/Logo";

const items = [
  { label: "Visão geral", href: "/admin", icon: LayoutDashboard },
  { label: "Clientes", href: "/admin/clientes", icon: Users },
  { label: "Produtos & estoque", href: "/admin/produtos", icon: Package },
];

export function AdminSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className={`admin-sidebar ${open ? "is-open" : ""}`}>
      <div className="admin-sidebar__brand">
        <Logo />
        <span className="admin-sidebar__brand-text">
          <strong>Tobacco Hemp</strong>
          <span>Painel administrativo</span>
        </span>
      </div>

      <nav className="admin-nav" aria-label="Navegação do painel">
        <p className="admin-nav__group">Gestão</p>
        {items.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="admin-nav__link"
            aria-current={pathname === href ? "page" : undefined}
            onClick={onClose}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </Link>
        ))}

        <p className="admin-nav__group">Comercial</p>
        <span className="admin-nav__link is-disabled" aria-disabled="true">
          <ShoppingCart size={18} aria-hidden="true" />
          Pedidos
          <span className="admin-nav__badge">Em breve</span>
        </span>
      </nav>

      <div className="admin-sidebar__footer">
        <Link href="/" onClick={onClose}>
          <ArrowLeft size={18} aria-hidden="true" />
          Voltar à loja
        </Link>
      </div>
    </aside>
  );
}
