"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Eye,
  ShoppingCart,
} from "lucide-react";
import { currency } from "@/lib/currency";
import { fetchOrders } from "@/lib/admin-service";
import { useResource } from "@/lib/use-resource";
import {
  ORDER_CHANNEL_LABEL,
  ORDER_PAYMENT_METHOD_LABEL,
  ORDER_STATUS_LABEL,
} from "@/modules/orders/domain/order-status";
import { ORDER_STATUSES, type Order } from "@/shared/contracts/orders";
import { DataTable, type Column, type Filter } from "./DataTable";
import { StatusBadge } from "./Badge";
import { KpiCard } from "./KpiCard";
import { OrderDetailModal } from "./OrderDetailModal";
import { OrderFormModal } from "./OrderFormModal";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const filters: Filter<Order>[] = [
  {
    key: "status",
    label: "Status",
    allLabel: "Todos os status",
    options: ORDER_STATUSES.map((status) => ({
      value: status,
      label: ORDER_STATUS_LABEL[status],
    })),
    match: (row, value) => row.status === value,
  },
  {
    key: "channel",
    label: "Canal",
    allLabel: "Todos os canais",
    options: [
      { value: "site", label: ORDER_CHANNEL_LABEL.site },
      { value: "whatsapp_link", label: ORDER_CHANNEL_LABEL.whatsapp_link },
    ],
    match: (row, value) => row.channel === value,
  },
];

export function OrdersTable() {
  const { status, data, retry, fail } = useResource(fetchOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => data ?? [], [data]);

  const summary = useMemo(() => {
    const pending = rows.filter((o) => o.status === "pending_payment").length;
    const paid = rows.filter((o) => o.status === "paid").length;
    const volumeCents = rows
      .filter((o) => o.status === "paid" || o.status === "pending_payment")
      .reduce((acc, o) => acc + o.totalCents, 0);
    return {
      total: rows.length,
      pending,
      paid,
      volumeCents,
    };
  }, [rows]);

  const columns: Column<Order>[] = [
    {
      key: "orderNumber",
      header: "Pedido",
      searchText: (o) => `${o.orderNumber} ${o.customerLabel} ${o.providerReference ?? ""}`,
      sortValue: (o) => o.orderNumber,
      render: (o) => (
        <>
          <span className="cell-primary">{o.orderNumber}</span>
          <span className="cell-sub">{o.customerLabel}</span>
        </>
      ),
    },
    {
      key: "channel",
      header: "Canal & Forma",
      searchText: (o) =>
        `${ORDER_CHANNEL_LABEL[o.channel]} ${ORDER_PAYMENT_METHOD_LABEL[o.paymentMethod]} ${o.paymentProvider}`,
      render: (o) => (
        <>
          <span>{ORDER_CHANNEL_LABEL[o.channel]}</span>
          <span className="cell-sub">
            {ORDER_PAYMENT_METHOD_LABEL[o.paymentMethod]} · {o.paymentProvider}
          </span>
        </>
      ),
    },
    {
      key: "totalCents",
      header: "Total",
      numeric: true,
      sortValue: (o) => o.totalCents,
      render: (o) => currency(o.totalCents / 100),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (o) => o.status,
      render: (o) => <StatusBadge status={o.status} />,
    },
    {
      key: "createdAt",
      header: "Criado em",
      sortValue: (o) => o.createdAt,
      render: (o) => dateFormat.format(new Date(o.createdAt)),
    },
    {
      key: "actions",
      header: "Ações",
      render: (o) => (
        <button
          type="button"
          className="admin-action-btn"
          onClick={() => setSelectedOrderId(o.id)}
          aria-label={`Ver detalhes do pedido ${o.orderNumber}`}
        >
          <Eye size={14} aria-hidden="true" />
          Detalhes
        </button>
      ),
    },
  ];

  const hint = "Pedidos demonstrativos — sem cobranças reais";

  return (
    <>
      <section className="kpi-grid orders-kpi-grid" aria-label="Resumo de pedidos">
        <KpiCard
          label="Pedidos registrados"
          value={String(summary.total)}
          delta={null}
          direction="up"
          hint={hint}
          icon={<ShoppingCart size={20} aria-hidden="true" />}
        />
        <KpiCard
          label="Aguardando pagamento"
          value={String(summary.pending)}
          delta={null}
          direction="up"
          hint={hint}
          icon={<Clock size={20} aria-hidden="true" />}
        />
        <KpiCard
          label="Pagos (demo)"
          value={String(summary.paid)}
          delta={null}
          direction="up"
          hint={hint}
          icon={<CheckCircle2 size={20} aria-hidden="true" />}
        />
        <KpiCard
          label="Volume demonstrativo"
          value={currency(summary.volumeCents / 100)}
          delta={null}
          direction="up"
          hint={hint}
          icon={<CircleDollarSign size={20} aria-hidden="true" />}
        />
      </section>

      <div className="admin-table-actions orders-table-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => setCreateOpen(true)}
        >
          Novo pedido demo
        </button>
      </div>

      <DataTable<Order>
        columns={columns}
        rows={rows}
        filters={filters}
        searchPlaceholder="Buscar por número, referência ou identificação"
        caption="Lista de pedidos demonstrativos"
        status={status}
        onRetry={retry}
        onSimulateError={fail}
        emptyTitle="Nenhum pedido registrado."
        emptyText="Crie um pedido demonstrativo ou ajuste os filtros para visualizar itens, valores e histórico."
      />

      <OrderDetailModal
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onUpdated={retry}
      />

      <OrderFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={retry}
      />
    </>
  );
}
