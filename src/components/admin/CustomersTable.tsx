"use client";

import { currency } from "@/lib/currency";
import { fetchCustomers } from "@/lib/admin-service";
import { useResource } from "@/lib/use-resource";
import { DataTable, type Column, type Filter } from "./DataTable";
import { StatusBadge } from "./Badge";
import type { Customer } from "@/types/admin";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const columns: Column<Customer>[] = [
  {
    key: "name",
    header: "Cliente",
    searchText: (c) => `${c.name} ${c.email} ${c.city}`,
    render: (c) => (
      <>
        <span className="cell-primary">{c.name}</span>
        <span className="cell-sub">{c.email}</span>
      </>
    ),
  },
  {
    key: "city",
    header: "Cidade",
    searchText: (c) => c.city,
    render: (c) => c.city,
  },
  {
    key: "orders",
    header: "Pedidos",
    numeric: true,
    sortValue: (c) => c.orders ?? 0,
    render: (c) => c.orders ?? "—",
  },
  {
    key: "spent",
    header: "Total gasto",
    numeric: true,
    sortValue: (c) => c.spent ?? 0,
    render: (c) => c.spent === null ? "—" : currency(c.spent),
  },
  {
    key: "status",
    header: "Status",
    render: (c) => <StatusBadge status={c.status} />,
  },
  {
    key: "joinedAt",
    header: "Cadastro",
    sortValue: (c) => c.joinedAt,
    render: (c) => dateFormat.format(new Date(c.joinedAt)),
  },
];

const filters: Filter<Customer>[] = [
  {
    key: "status",
    label: "Status",
    allLabel: "Todos os status",
    options: [
      { value: "ativo", label: "Ativos" },
      { value: "novo", label: "Novos" },
      { value: "inativo", label: "Inativos" },
    ],
    match: (row, value) => row.status === value,
  },
];

export function CustomersTable() {
  const { status, data, retry, fail } = useResource(fetchCustomers);

  return (
    <DataTable<Customer>
      columns={columns}
      rows={data ?? []}
      filters={filters}
      searchPlaceholder="Buscar por nome, e-mail ou cidade"
      caption="Lista de clientes demonstrativos"
      status={status}
      onRetry={retry}
      onSimulateError={fail}
      emptyTitle="Nenhum cliente encontrado."
      emptyText="Ajuste a busca ou os filtros para ver os clientes cadastrados."
    />
  );
}
