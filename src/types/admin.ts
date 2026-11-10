export type CustomerStatus = "ativo" | "inativo" | "novo";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  orders: number | null;
  spent: number | null;
  status: CustomerStatus;
  joinedAt: string;
}

export type StockStatus = "em_estoque" | "baixo" | "esgotado";

export interface AdminProduct {
  id: string;
  name: string;
  category: string;
  categorySlug: string;
  price: number;
  stock: number;
  sold: number | null;
  revenue: number | null;
  sku?: string;
  active?: boolean;
  reorderPoint?: number;
  status: StockStatus;
}

export interface Kpi {
  id: string;
  label: string;
  value: string;
  delta: number | null;
  direction: "up" | "down";
  hint: string;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface DashboardMetrics {
  kpis: Kpi[];
  salesSeries: SeriesPoint[];
  categoryPerformance: SeriesPoint[];
  lowStock: AdminProduct[];
}
