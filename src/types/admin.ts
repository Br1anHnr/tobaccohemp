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

export interface AdminProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  categorySlug: string;
  price: number;
  stock: number;
  sold: number | null;
  revenue: number | null;
  sku?: string;
  active?: boolean;
  archived?: boolean;
  isNew?: boolean;
  isFeatured?: boolean;
  variants?: string[];
  tags?: string[];
  images?: AdminProductImage[];
  reorderPoint?: number;
  status: StockStatus;
}

export interface AdminCategory {
  slug: string;
  name: string;
  description: string;
  image: string;
  productCount: number;
  createdAt: string;
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
