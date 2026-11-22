"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { AdminSessionGate } from "./AdminSessionGate";

const sectionFor = (pathname: string) => {
  if (pathname === "/admin") return "Visão geral";
  if (pathname.startsWith("/admin/clientes")) return "Clientes";
  if (pathname.startsWith("/admin/produtos")) return "Produtos & estoque";
  if (pathname.startsWith("/admin/categorias")) return "Categorias";
  if (pathname.startsWith("/admin/asaas")) return "Asaas Sandbox";
  if (pathname.startsWith("/admin/pedidos")) return "Pedidos";
  return "Painel administrativo";
};

export function AdminShell({
  children,
  sandboxEnabled = false,
}: {
  children: ReactNode;
  sandboxEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (pathname === "/admin/login") {
    return <main id="admin-main" className="admin-login"><AdminSessionGate>{children}</AdminSessionGate></main>;
  }

  return (
    <MotionConfig reducedMotion="user">
      <a href="#admin-main" className="skip-link">
        Pular para o conteúdo
      </a>
      <div className="admin-shell">
        <AdminSidebar open={menuOpen} onClose={() => setMenuOpen(false)} sandboxEnabled={sandboxEnabled} />
        {menuOpen && (
          <button
            type="button"
            className="admin-backdrop"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <div className="admin-main">
          <AdminTopbar
            section={sectionFor(pathname)}
            onMenu={() => setMenuOpen(true)}
          />
          <main id="admin-main" tabIndex={-1}>
            <div className="admin-content"><AdminSessionGate>{children}</AdminSessionGate></div>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
