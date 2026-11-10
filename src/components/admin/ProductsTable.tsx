"use client";

import { useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { currency } from "@/lib/currency";
import { fetchProducts, updateStock } from "@/lib/admin-service";
import { useResource } from "@/lib/use-resource";
import { DataTable, type Column, type Filter } from "./DataTable";
import { StatusBadge } from "./Badge";
import type { AdminProduct } from "@/types/admin";

const filtersFor = (rows: AdminProduct[]): Filter<AdminProduct>[] => [
  {
    key: "category",
    label: "Categoria",
    allLabel: "Todas as categorias",
    options: Array.from(new Set(rows.map(row => row.category))).map(value => ({ value, label: value })),
    match: (row, value) => row.category === value,
  },
  {
    key: "status",
    label: "Status",
    allLabel: "Todos os status",
    options: [
      { value: "em_estoque", label: "Em estoque" },
      { value: "baixo", label: "Estoque baixo" },
      { value: "esgotado", label: "Esgotados" },
    ],
    match: (row, value) => row.status === value,
  },
];

export function ProductsTable() {
  const { status, data, retry, fail } = useResource(fetchProducts);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState("");
  const busy = useRef(false);
  const rows = data ?? [];
  const filters = useMemo(() => filtersFor(data ?? []), [data]);

  const adjustStock = async (id: string, delta: number) => {
    const product = data?.find(row => row.id === id);
    if (busy.current || !product) return;
    busy.current = true; setPendingId(id); setMutationError("");
    try {
      await updateStock(id, Math.max(0, product.stock + delta), product.reorderPoint ?? 0);
      retry();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Não foi possível atualizar o estoque.");
    } finally { busy.current = false; setPendingId(null); }
  };

  const columns: Column<AdminProduct>[] = [
    {
      key: "name",
      header: "Produto",
      searchText: (p) => `${p.name} ${p.category}`,
      render: (p) => (
        <>
          <span className="cell-primary">{p.name}</span>
          <span className="cell-sub">{p.category}</span>
        </>
      ),
    },
    {
      key: "category",
      header: "Categoria",
      searchText: (p) => p.category,
      render: (p) => p.category,
    },
    {
      key: "price",
      header: "Preço",
      numeric: true,
      sortValue: (p) => p.price,
      render: (p) => currency(p.price),
    },
    {
      key: "stock",
      header: "Estoque",
      numeric: true,
      sortValue: (p) => p.stock,
      render: (p) => (
        <span className="stock-control">
          <button
            type="button"
            onClick={() => adjustStock(p.id, -1)}
            disabled={p.stock <= 0 || pendingId !== null}
            aria-label={`Diminuir estoque de ${p.name}`}
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <span className="stock-value">{p.stock}</span>
          <button
            type="button"
            onClick={() => adjustStock(p.id, 1)}
            disabled={pendingId !== null}
            aria-label={`Aumentar estoque de ${p.name}`}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "sold",
      header: "Vendidos",
      numeric: true,
      sortValue: (p) => p.sold ?? 0,
      render: (p) => p.sold ?? "—",
    },
  ];

  return (
    <>
    {mutationError && <p role="alert">{mutationError}</p>}
    <DataTable<AdminProduct>
      columns={columns}
      rows={rows}
      filters={filters}
      searchPlaceholder="Buscar por produto ou categoria"
      caption="Lista de produtos e estoque demonstrativos"
      status={status}
      onRetry={retry}
      onSimulateError={fail}
      emptyTitle="Nenhum produto encontrado."
      emptyText="Ajuste a busca ou os filtros para ver os produtos e o estoque."
    />
    </>
  );
}
