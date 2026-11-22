"use client";

import {
  CircleDollarSign,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { fetchDashboard } from "@/lib/admin-service";
import { useResource } from "@/lib/use-resource";
import { KpiCard } from "./KpiCard";
import { LineChart } from "./LineChart";
import { BarChart } from "./BarChart";
import { StatusBadge } from "./Badge";
import { ErrorState } from "./TableStates";
import type { AdminProduct } from "@/types/admin";

const kpiIcons: Record<string, ReactNode> = {
  revenue: <CircleDollarSign size={20} aria-hidden="true" />,
  orders: <ShoppingBag size={20} aria-hidden="true" />,
  customers: <Users size={20} aria-hidden="true" />,
  conversion: <TrendingUp size={20} aria-hidden="true" />,
};

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Carregando painel">
      <span className="sr-only">Carregando painel…</span>
      <div className="skeleton-grid">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
      <div className="skeleton skeleton-chart" />
    </div>
  );
}

function LowStockList({ items }: { items: AdminProduct[] }) {
  if (items.length === 0) {
    return <p className="low-stock-empty">Nenhum produto em estoque baixo.</p>;
  }
  return (
    <div className="low-stock-list">
      {items.map((product) => (
        <div key={product.id} className="low-stock-item">
          <span className="low-stock-item__thumb" aria-hidden="true">
            <Package size={18} />
          </span>
          <span className="low-stock-item__info">
            <strong>{product.name}</strong>
            <span>{product.category}</span>
          </span>
          <StatusBadge status={product.status} />
          <span className="low-stock-item__qty">{product.stock} un.</span>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { status, data, retry } = useResource(fetchDashboard);

  if (status === "loading") return <DashboardSkeleton />;
  if (status === "error" || !data) {
    return (
      <div className="table-card">
        <ErrorState onRetry={retry} />
      </div>
    );
  }

  return (
    <>
      <section className="kpi-grid" aria-label="Indicadores principais">
        {data.kpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            direction={kpi.direction}
            hint={kpi.hint}
            icon={kpiIcons[kpi.id]}
          />
        ))}
      </section>

      <div className="chart-grid">
        <section className="chart-card">
          <h2>Volume demonstrativo</h2>
          <p>Vendas reais desabilitadas — apenas pedidos demonstrativos.</p>
          {data.salesSeries.length > 0 ? <LineChart
            data={data.salesSeries}
            ariaLabel="Gráfico de linha com o volume demonstrativo diário dos últimos 14 dias"
          /> : <p className="table-state">Nenhum pedido demonstrativo nesta janela.</p>}
        </section>

        <section className="chart-card">
          <h2>Estoque baixo</h2>
          <p>Produtos abaixo do limite de reposição</p>
          <LowStockList items={data.lowStock} />
        </section>

        <section className="chart-card is-full">
          <h2>Volume demonstrativo por categoria</h2>
          <p>Distribuição de pedidos demonstrativos — sem receita comercial.</p>
          {data.categoryPerformance.length > 0 ? <BarChart
            data={data.categoryPerformance}
            ariaLabel="Gráfico de barras com o volume demonstrativo por categoria"
          /> : <p className="table-state">Nenhum pedido demonstrativo por categoria.</p>}
        </section>
      </div>
    </>
  );
}
