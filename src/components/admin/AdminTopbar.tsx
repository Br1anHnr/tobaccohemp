"use client";

import Link from "next/link";
import { ExternalLink, Menu } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAdmin } from "@/lib/admin-service";

export function AdminTopbar({
  section,
  onMenu,
}: {
  section: string;
  onMenu: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true); setError("");
    try { await logoutAdmin(); router.replace("/admin/login"); }
    catch { setError("Não foi possível sair. Tente novamente."); }
    finally { setPending(false); }
  }
  return (
    <header className="admin-topbar">
      <button
        type="button"
        className="icon-button menu-toggle"
        onClick={onMenu}
        aria-label="Abrir menu"
      >
        <Menu size={22} aria-hidden="true" />
      </button>
      <span className="admin-topbar__title">{section}</span>
      <span className="demo-chip">Dados demonstrativos</span>
      <button type="button" className="text-link" disabled={pending} onClick={logout}>{pending ? "Saindo…" : "Sair"}</button>
      {error && <span role="alert">{error}</span>}
      <Link href="/" className="text-link">
        Ver loja
        <ExternalLink size={14} aria-hidden="true" />
      </Link>
    </header>
  );
}
