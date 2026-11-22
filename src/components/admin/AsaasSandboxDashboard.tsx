"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { currency } from "@/lib/currency";
import { ShoppingCart } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { ORDER_STATUS_LABEL, ORDER_STOCK_STATUS_LABEL } from "@/modules/orders/domain/order-status";
import type { OrderStatus, OrderStockStatus } from "@/shared/contracts/orders";
import type { sandboxDashboard } from "@/modules/orders/infrastructure/asaas-sandbox";

type Dashboard = Awaited<ReturnType<typeof sandboxDashboard>>;
const attemptLabel: Record<string,string> = { prepared: "Preparando", creating: "Registrando tentativa", uncertain: "Aguardando conciliação", ready: "Pronto para consulta", review: "Revisão necessária" };
export function AsaasSandboxDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  async function refresh() {
    try {
      const response = await fetch("/api/admin/asaas", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Falha ao carregar Sandbox.");
      setData(body.data); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Falha ao carregar."); }
  }
  useEffect(() => { void Promise.resolve().then(refresh); }, []);
  async function reconcile(orderId: string) {
    try {
      const response = await fetch("/api/admin/asaas/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({orderId}) });
      const body = await response.json();
      if (!response.ok || body.data.warning) throw new Error(body.error?.message ?? "Conciliação pendente; confira o estado do pedido.");
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Falha na conciliação."); }
  }
  return <div className="asaas-dashboard">
    <div><Button onClick={refresh} variant="secondary">Atualizar painel Sandbox</Button></div>
    {error && <p role="alert">{error}</p>}
    {data && <>
      <div className="kpi-grid">{data.summary.map(row => <KpiCard key={row.status} label={ORDER_STATUS_LABEL[row.status as OrderStatus] ?? row.status} value={currency(Number(row.total_cents) / 100)} delta={null} direction="up" hint={`${row.count} ${row.count === 1 ? "pedido" : "pedidos"} de teste`} icon={<ShoppingCart size={20} />} />)}</div>
      <h2>Pedidos e estoque de teste</h2>
      {!data.attempts.length && <p>Nenhum pedido Sandbox registrado.</p>}
      {data.attempts.map(row => <section className="summary-panel asaas-order-card" key={row.id}><h3>{row.order_number}</h3><p>{ORDER_STATUS_LABEL[row.status as OrderStatus] ?? row.status} · {currency(Number(row.total_cents) / 100)}</p><p>{ORDER_STOCK_STATUS_LABEL[row.stock_status as OrderStockStatus] ?? row.stock_status}</p><p>{attemptLabel[row.state] ?? "Revisão necessária"} · Provedor: {row.last_provider_status ?? "aguardando"}</p><div><Button variant="secondary" onClick={() => reconcile(row.id)}>Reconciliar pedido</Button></div><Link className="text-link" href={`/checkout?asaasOrder=${encodeURIComponent(row.id)}`}>Consultar com a sessão do comprador</Link></section>)}
      <h2>Histórico Sandbox</h2>
      <ul>{data.history.map((row,index) => <li key={index}>{ORDER_STATUS_LABEL[row.to_status as OrderStatus] ?? row.to_status} — {row.reason}</li>)}</ul>
    </>}
  </div>;
}
