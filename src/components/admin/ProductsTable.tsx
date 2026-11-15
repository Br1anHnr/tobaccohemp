"use client";

import { useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, Minus, Pencil, Plus } from "lucide-react";
import { currency } from "@/lib/currency";
import { fetchProducts, fetchCategories, updateStock, archiveProduct, updateProduct } from "@/lib/admin-service";
import { useResource } from "@/lib/use-resource";
import { DataTable, type Column, type Filter } from "./DataTable";
import { StatusBadge } from "./Badge";
import { ProductForm } from "./ProductForm";
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
      { value: "arquivado", label: "Arquivados" },
    ],
    match: (row, value) => (value === "arquivado" ? Boolean(row.archived) : !row.archived && row.status === value),
  },
];

export function ProductsTable() {
  const productsResource = useResource(fetchProducts);
  const categoriesResource = useResource(fetchCategories);
  const { status, data, retry, fail } = productsResource;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const busy = useRef(false);
  const rows = data ?? [];
  const categories = categoriesResource.data ?? [];
  const filters = useMemo(() => filtersFor(data ?? []), [data]);

  const mutate = async (id: string, operation: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true; setPendingId(id); setMutationError("");
    try {
      await operation();
      retry();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    } finally { busy.current = false; setPendingId(null); }
  };

  const adjustStock = (id: string, delta: number) => {
    const product = data?.find(row => row.id === id);
    if (!product) return;
    void mutate(id, () => updateStock(id, Math.max(0, product.stock + delta), product.reorderPoint ?? 0));
  };

  const toggleArchive = (product: AdminProduct) =>
    void mutate(product.id, () => product.archived ? updateProduct(product.id, { archived: false }) : archiveProduct(product.id));

  const columns: Column<AdminProduct>[] = [
    {
      key: "name",
      header: "Produto",
      searchText: (p) => `${p.name} ${p.category} ${p.sku ?? ""}`,
      render: (p) => (
        <>
          <span className="cell-primary">{p.name}</span>
          <span className="cell-sub">
            {p.category}
            {p.archived ? " · Arquivado" : ""}
          </span>
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
      render: (p) => (p.archived ? <StatusBadge status="arquivado" /> : <StatusBadge status={p.status} />),
    },
    {
      key: "actions",
      header: "Ações",
      render: (p) => (
        <span className="row-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={`Editar ${p.name}`}
            onClick={() => { setEditing(p); setFormOpen(true); }}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={p.archived ? `Desarquivar ${p.name}` : `Arquivar ${p.name}`}
            disabled={pendingId !== null}
            onClick={() => toggleArchive(p)}
          >
            {p.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
    {mutationError && <p role="alert">{mutationError}</p>}
    <div className="admin-table-actions">
      <button
        type="button"
        className="button button-primary"
        onClick={() => { setEditing(null); setFormOpen(true); }}
      >
        Cadastrar produto
      </button>
    </div>
    <DataTable<AdminProduct>
      columns={columns}
      rows={rows}
      filters={filters}
      searchPlaceholder="Buscar por produto, SKU ou categoria"
      caption="Lista de produtos e estoque demonstrativos"
      status={status}
      onRetry={retry}
      onSimulateError={fail}
      emptyTitle="Nenhum produto encontrado."
      emptyText="Ajuste a busca ou os filtros para ver os produtos e o estoque."
    />
    {formOpen && (
      <ProductForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={retry}
        product={editing}
        categories={categories}
      />
    )}
    </>
  );
}
