/** Shared wire contract. IDs are opaque; timestamps are ISO-8601 UTC; BRL uses integer cents. */
export type CustomerStatus = "active" | "inactive";
export interface Customer {
  id: string;
  name: string;
  email: string;
  status: CustomerStatus;
  createdAt: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;
}

export interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  brand: string;
  categorySlug: string | null;
  categoryName: string | null;
  priceCents: number;
  active: boolean;
  archived: boolean;
  isNew: boolean;
  isFeatured: boolean;
  tags: string[];
  variants: string[];
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

/** Scalars accepted on create/update. `archived` drives soft-delete (archive). */
export type ProductInput = Partial<
  Pick<
    Product,
    | "slug"
    | "sku"
    | "name"
    | "description"
    | "brand"
    | "categorySlug"
    | "priceCents"
    | "active"
    | "archived"
    | "isNew"
    | "isFeatured"
    | "tags"
    | "variants"
  >
>;

export interface Category {
  slug: string;
  name: string;
  description: string;
  image: string;
  productCount: number;
  createdAt: string;
}
export type CategoryInput = Pick<Category, "slug" | "name" | "description" | "image">;

export interface InventoryItem {
  productId: string;
  quantity: number;
  reorderPoint: number;
  updatedAt: string;
}
export type InventoryInput = Pick<InventoryItem, "quantity" | "reorderPoint">;

/** One point of a dashboard series. `value` is expressed in BRL reais. */
export interface DashboardSeriesPoint {
  label: string;
  value: number;
}

export interface DashboardMetrics {
  customers: number;
  products: number;
  units: number;
  lowStockProducts: number;
  stockValueCents: number;
  /** Daily demonstrative order volume over the trailing window (empty when none). */
  salesSeries: DashboardSeriesPoint[];
  /** Demonstrative order volume grouped by category (empty when none). */
  categoryPerformance: DashboardSeriesPoint[];
}

export interface OperationsDashboardMetrics {
  customers: number;
  products: number;
  units: number;
  stockValueCents: number;
  confirmedCents: number;
  averagePaidCents: number | null;
  ordersByStatus: Array<{ status: import("./orders").OrderStatus; count: number }>;
  recent: Array<{ id: string; number: string; status: import("./orders").OrderStatus; totalCents: number; createdAt: string }>;
  lowStock: Array<{ id: string; name: string; quantity: number; reorderPoint: number }>;
  bestSellers: DashboardSeriesPoint[];
  salesSeries: DashboardSeriesPoint[];
  orderSeries: DashboardSeriesPoint[];
  categoryPerformance: DashboardSeriesPoint[];
}

/** Minimal role-based access control. `admin` implies every `operator` capability. */
export type AdminRole = "admin" | "operator";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

/** Administrative account (server-side view) exposed only to admins. */
export interface AdminAccount extends AdminUser {
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAccountInput {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
}

export interface AdminAccountPatch {
  name?: string;
  role?: AdminRole;
  active?: boolean;
  password?: string;
}

export interface LoginInput { email: string; password: string }
export interface DataResponse<T> { data: T }
export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export const adminEndpoints = {
  login: "/api/admin/auth/login",
  logout: "/api/admin/auth/logout",
  session: "/api/admin/auth/session",
  accounts: "/api/admin/accounts",
  customers: "/api/admin/customers",
  products: "/api/admin/products",
  categories: "/api/admin/categories",
  inventory: "/api/admin/inventory",
  orders: "/api/admin/orders",
  dashboard: "/api/admin/dashboard",
} as const;
