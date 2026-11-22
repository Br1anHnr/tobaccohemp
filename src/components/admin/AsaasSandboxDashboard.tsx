"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { currency } from "@/lib/currency";
import { ShoppingCart } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { ORDER_STATUS_LABEL, ORDER_STOCK_STATUS_LABEL } from "@/modules/orders/domain/order-status";
import type { AdminRole } from "@/shared/contracts/admin";
import type { OrderStatus, OrderStockStatus } from "@/shared/contracts/orders";
import type { sandboxDashboard } from "@/modules/orders/infrastructure/asaas-sandbox";

type Dashboard = Awaited<ReturnType<typeof sandboxDashboard>>;
const attemptLabel: Record<string, string> = {
  prepared: "Preparando",
  creating: "Registrando tentativa",
  uncertain: "Aguardando conciliação",
  ready: "Pronto para consulta",
  review: "Revisão necessária",
};
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function AsaasSandboxDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/admin/asaas", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Falha ao carregar Sandbox.");
      setData(body.data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar.");
    }
  }

  useEffect(() => {
    void Promise.resolve().then(refresh);
    void fetch("/api/admin/auth/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const userRole = body?.data?.role;
        if (userRole === "admin" || userRole === "operator") setRole(userRole);
      })
      .catch(() => {});
  }, []);

  async function reconcile(orderId: string) {
    setBusyId(orderId);
    try {
      const response = await fetch("/api/admin/asaas/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = await response.json().catch(() => null);
      await refresh();
      if (!response.ok || body?.data?.warning) {
        throw new Error(body?.error?.message ?? "Conciliação pendente; confira o estado do pedido.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na conciliação.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelAttempt(orderId: string) {
    setBusyId(orderId);
    try {
      const response = await fetch("/api/admin/asaas/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = await response.json().catch(() => null);
      await refresh();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Não foi possível cancelar a tentativa.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cancelar tentativa.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="asaas-dashboard">
      <div><Button onClick={refresh} variant="secondary">Atualizar painel Sandbox</Button></div>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <div className="kpi-grid">
            {data.summary.map(row => (
              <KpiCard
                key={row.status}
                label={ORDER_STATUS_LABEL[row.status as OrderStatus] ?? row.status}
                value={currency(Number(row.total_cents) / 100)}
                delta={null}
                direction="up"
                hint={`${row.count} ${row.count === 1 ? "pedido" : "pedidos"} de teste`}
                icon={<ShoppingCart size={20} />}
              />
            ))}
          </div>
          <h2>Pedidos e estoque de teste</h2>
          {!data.attempts.length && <p>Nenhum pedido Sandbox registrado.</p>}
          {data.attempts.map(row => {
            const canCancel = role === "admin" && !["paid", "refunded", "canceled", "expired"].includes(row.status);
            return (
              <section className="summary-panel asaas-order-card" key={row.id}>
                <h3>{row.order_number}</h3>
                <p>
                  {ORDER_STATUS_LABEL[row.status as OrderStatus] ?? row.status} ·{" "}
                  {currency(Number(row.total_cents) / 100)}
                  {row.payment_method ? ` · ${row.payment_method === "pix" ? "Pix" : "Cartão"}` : ""}
                </p>
                <p>{ORDER_STOCK_STATUS_LABEL[row.stock_status as OrderStockStatus] ?? row.stock_status}</p>
                <p>{attemptLabel[row.state] ?? "Revisão necessária"} · Provedor: {row.last_provider_status ?? "aguardando"}</p>
                {row.last_error_code && (
                  <p className="muted">
                    Último diagnóstico: {row.last_error_code}
                    {row.last_error_status ? ` (HTTP ${row.last_error_status})` : ""}
                  </p>
                )}
                {role === "admin" && (
                  <div className="order-actions-row">
                    <Button variant="secondary" disabled={busyId === row.id} onClick={() => reconcile(row.id)}>
                      Reconciliar pedido
                    </Button>
                    {canCancel && (
                      <Button variant="secondary" disabled={busyId === row.id} onClick={() => cancelAttempt(row.id)}>
                        Cancelar e liberar estoque
                      </Button>
                    )}
                  </div>
                )}
                <Link className="text-link" href={`/checkout?asaasOrder=${encodeURIComponent(row.id)}`}>
                  Consultar com a sessão do comprador
                </Link>
              </section>
            );
          })}
          <h2>Histórico Sandbox</h2>
          <ul>
            {data.history.map((row, index) => (
              <li key={index}>
                {row.order_number ? `${row.order_number} · ` : ""}
                {ORDER_STATUS_LABEL[row.to_status as OrderStatus] ?? row.to_status}
                {row.created_at ? ` (${dateTimeFormat.format(new Date(row.created_at))})` : ""}
                {" — "}
                {row.reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
