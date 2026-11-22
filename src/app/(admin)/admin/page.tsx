import type { Metadata } from "next";
import { Dashboard } from "@/components/admin/Dashboard";

export const metadata: Metadata = {
  title: "Painel",
};

export default function AdminDashboardPage() {
  return (
    <>
      <div className="admin-page-head">
        <p className="eyebrow">Visão geral</p>
        <h1>
          Painel<span className="accent-dot">.</span>
        </h1>
        <p>
          Acompanhe os principais indicadores da operação. Todos os valores são
          fictícios e servem apenas para demonstração.
        </p>
      </div>
      <Dashboard />
    </>
  );
}
