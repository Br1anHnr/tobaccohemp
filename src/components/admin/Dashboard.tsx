"use client";

import {
  CircleDollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { fetchDashboard } from "@/lib/admin-service";
import { useResource } from "@/lib/use-resource";
import { currency } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import { ORDER_STATUS_LABEL } from "@/modules/orders/domain/order-status";
import { KpiCard } from "./KpiCard";
import { LineChart } from "./LineChart";
import { BarChart } from "./BarChart";
import { ErrorState } from "./TableStates";
import { OrderDetailModal } from "./OrderDetailModal";

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

const counts = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const orderDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
});

export function Dashboard() {
  const [environment, setEnvironment] = useState<"commercial" | "sandbox">("commercial");
  const [period, setPeriod] = useState("30");
  const [interval, setInterval] = useState("day");
  const [detailId, setDetailId] = useState<string | null>(null);
  const selection = `${environment}:${period}:${interval}`;
  const fetcher = useCallback(async () => {
    return { selection, data: await fetchDashboard(environment, period, interval) };
  }, [environment, interval, period, selection]);
  const { status, data: result, retry } = useResource(fetcher);
  const selectionLoaded = result?.selection === selection;
  const data = selectionLoaded ? result.data : null;
  const sandbox = environment === "sandbox";

  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") retry();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => document.removeEventListener("visibilitychange", refreshOnReturn);
  }, [retry]);

  const changeEnvironment = (next: typeof environment) => {
    setDetailId(null);
    setEnvironment(next);
  };
  const cards = data && [
    { label: "Clientes cadastrados", value: counts.format(data.customers), icon: "customers", hint: "Neste ambiente" },
    { label: "Pedidos no período", value: counts.format(data.ordersByStatus.reduce((sum, row) => sum + row.count, 0)), icon: "orders" },
    { label: sandbox ? "Receita de teste confirmada" : "Receita confirmada", value: currency(data.confirmedCents / 100), icon: "revenue" },
    { label: "Ticket médio pago", value: data.averagePaidCents === null ? "—" : currency(data.averagePaidCents / 100), icon: "conversion" },
    { label: "Produtos ativos", value: counts.format(data.products), icon: "orders", hint: "Neste ambiente" },
    { label: "Unidades em estoque", value: counts.format(data.units), icon: "orders", hint: "Estoque atual" },
    { label: "Valor em estoque", value: currency(data.stockValueCents / 100), icon: "revenue", hint: "Ao preço de venda atual" },
  ];

  return <>
    <div className="order-actions-row" role="group" aria-label="Ambiente do painel">
      <Button variant={sandbox ? "secondary" : "primary"} aria-pressed={!sandbox} onClick={() => changeEnvironment("commercial")}>Operação comercial</Button>
      <Button variant={sandbox ? "primary" : "secondary"} aria-pressed={sandbox} onClick={() => changeEnvironment("sandbox")}>Ambiente de testes</Button>
    </div>
    <p className="cell-sub">{sandbox ? "Asaas Sandbox · pagamentos sintéticos e estoque isolado." : "Pedidos e estoque da operação comercial."}</p>
    <div className="order-actions-row dashboard-filters">
      <label>Período
        <select value={period} onChange={event => setPeriod(event.target.value)}>
          {[7, 30, 90, 365].map(days => <option key={days} value={days}>Últimos {days} dias</option>)}
        </select>
      </label>
      <label>Agrupar por
        <select value={interval} onChange={event => setInterval(event.target.value)}>
          <option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option>
        </select>
      </label>
      <Button variant="secondary" onClick={retry}>Atualizar painel</Button>
      {sandbox && <Link className="text-link" href="/admin/asaas">Gerenciar pedidos de teste</Link>}
    </div>
    {(status === "loading" || (status === "success" && !selectionLoaded)) && <DashboardSkeleton />}
    {status === "error" && <div className="table-card"><ErrorState onRetry={retry} /></div>}
    {status === "success" && data && <>
      <section className="kpi-grid" aria-label="Indicadores principais">
        {cards?.map(card => <KpiCard key={card.label} {...card} hint={card.hint ?? "No período selecionado"} delta={null} direction="up" icon={kpiIcons[card.icon]} />)}
      </section>
      <div className="chart-grid">
        <section className="chart-card">
          <h2>Vendas confirmadas</h2>
          {data.salesSeries.length ? <LineChart data={data.salesSeries} ariaLabel="Receita confirmada no período" /> : <p>Nenhuma venda confirmada no período.</p>}
        </section>
        <section className="chart-card">
          <h2>Evolução de pedidos</h2>
          {data.orderSeries.length ? <LineChart data={data.orderSeries} ariaLabel="Pedidos criados no período" formatValue={value => counts.format(value)} /> : <p>Nenhum pedido no período.</p>}
          {data.ordersByStatus.length > 0 && <ul>{data.ordersByStatus.map(row => <li key={row.status}>{ORDER_STATUS_LABEL[row.status]} · {counts.format(row.count)}</li>)}</ul>}
        </section>
        <section className="chart-card">
          <h2>Vendas por categoria</h2>
          {data.categoryPerformance.length ? <BarChart data={data.categoryPerformance} ariaLabel="Valor dos itens pagos por categoria" /> : <p>Nenhuma categoria com itens pagos no período.</p>}
        </section>
        <section className="chart-card">
          <h2>Mais vendidos</h2>
          {data.bestSellers.length ? <ol>{data.bestSellers.map((row, index) => <li key={index}>{row.label} · {counts.format(row.value)} un.</li>)}</ol> : <p>Nenhum item pago no período.</p>}
        </section>
        <section className="chart-card">
          <h2>Estoque baixo</h2>
          {data.lowStock.length ? <ul>{data.lowStock.map(row => <li key={row.id}>{row.name} · {row.quantity} un. (mín. {row.reorderPoint})</li>)}</ul> : <p>Nenhum produto em estoque baixo.</p>}
        </section>
        <section className="chart-card">
          <h2>Pedidos recentes</h2>
          {data.recent.length ? <ul className="dashboard-recent">{data.recent.map(row => <li key={row.id}>
            <button type="button" className="text-link" onClick={() => setDetailId(row.id)}>{row.number}</button>
            <span>{ORDER_STATUS_LABEL[row.status]} · {currency(row.totalCents / 100)}</span>
            <time dateTime={row.createdAt}>{orderDate.format(new Date(row.createdAt))}</time>
          </li>)}</ul> : <p>Nenhum pedido no período.</p>}
        </section>
      </div>
    </>}
    <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} onUpdated={retry} sandbox={sandbox} />
  </>;
}
