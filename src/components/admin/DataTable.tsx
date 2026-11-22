"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, TriangleAlert } from "lucide-react";
import { normalize } from "@/lib/utils";
import type { ResourceStatus } from "@/lib/use-resource";
import { EmptyState, ErrorState, LoadingState } from "./TableStates";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  searchText?: (row: T) => string;
  sortValue?: (row: T) => string | number;
  numeric?: boolean;
}

export interface Filter<T> {
  key: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
}

type Sort = { key: string; dir: "asc" | "desc" };

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  filters = [],
  searchPlaceholder,
  caption,
  status,
  onRetry,
  onSimulateError,
  emptyTitle,
  emptyText,
}: {
  columns: Column<T>[];
  rows: T[];
  filters?: Filter<T>[];
  searchPlaceholder: string;
  caption: string;
  status: ResourceStatus;
  onRetry: () => void;
  onSimulateError: () => void;
  emptyTitle: string;
  emptyText: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort | null>(null);

  const filtered = useMemo(() => {
    let out = rows;

    const term = normalize(query.trim());
    if (term) {
      out = out.filter((row) =>
        columns.some(
          (col) => col.searchText && normalize(col.searchText(row)).includes(term),
        ),
      );
    }

    for (const filter of filters) {
      const value = active[filter.key];
      if (value && value !== "all") {
        out = out.filter((row) => filter.match(row, value));
      }
    }

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          const cmp =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv), "pt-BR");
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }

    return out;
  }, [rows, query, active, sort, columns, filters]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const resultLabel =
    filtered.length === 1
      ? "1 resultado"
      : `${filtered.length} resultados`;

  return (
    <div className="table-card">
      <div className="table-toolbar">
        <label className="table-search" htmlFor={`${id}-search`}>
          <Search size={16} aria-hidden="true" />
          <input
            id={`${id}-search`}
            type="search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={status !== "success"}
          />
        </label>

        {filters.map((filter) => (
          <div key={filter.key}>
            <label htmlFor={`${id}-${filter.key}`} className="sr-only">
              {filter.label}
            </label>
            <select
              id={`${id}-${filter.key}`}
              className="table-filter"
              value={active[filter.key] ?? "all"}
              onChange={(event) =>
                setActive((prev) => ({ ...prev, [filter.key]: event.target.value }))
              }
              disabled={status !== "success"}
            >
              <option value="all">{filter.allLabel}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {status === "success" && (
          <button
            type="button"
            className="text-link"
            onClick={onSimulateError}
            aria-label="Simular falha de carregamento"
          >
            <TriangleAlert size={14} aria-hidden="true" />
            Simular falha
          </button>
        )}
      </div>

      {status === "loading" && <LoadingState />}
      {status === "error" && <ErrorState onRetry={onRetry} />}

      {status === "success" && filtered.length === 0 && (
        <EmptyState title={emptyTitle} text={emptyText} />
      )}

      {status === "success" && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <caption>{caption}</caption>
            <thead>
              <tr>
                {columns.map((col) => {
                  const isSorted = sort?.key === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={col.numeric ? "num" : undefined}
                      aria-sort={
                        isSorted
                          ? sort!.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      {col.sortValue ? (
                        <button
                          type="button"
                          className="th-sort"
                          onClick={() => toggleSort(col.key)}
                        >
                          {col.header}
                          {isSorted ? (
                            sort!.dir === "asc" ? (
                              <ArrowUp size={12} aria-hidden="true" />
                            ) : (
                              <ArrowDown size={12} aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown size={12} aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  {columns.map((col) => (
                    <td key={col.key} className={col.numeric ? "num" : undefined}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status === "success" && (
        <div className="table-footer">
          <span>{resultLabel}</span>
          <span>Dados fictícios para demonstração.</span>
        </div>
      )}
    </div>
  );
}
