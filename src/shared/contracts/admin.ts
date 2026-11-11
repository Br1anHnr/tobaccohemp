/** Shared wire contract. IDs are opaque; timestamps are ISO-8601 UTC; BRL uses integer cents. */
export type CustomerStatus = "active" | "inactive";
export interface Customer {
  id: string;
  name: string;
  email: string;
  status: CustomerStatus;
  createdAt: string;
}
export type CustomerInput = Pick<Customer, "name" | "email" | "status">;

export interface Product {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  active: boolean;
  createdAt: string;
}
export type ProductInput = Pick<Product, "sku" | "name" | "priceCents" | "active">;

export interface InventoryItem {
  productId: string;
  quantity: number;
  reorderPoint: number;
  updatedAt: string;
}
export type InventoryInput = Pick<InventoryItem, "quantity" | "reorderPoint">;

export interface DashboardMetrics {
  customers: number;
  products: number;
  units: number;
  lowStockProducts: number;
  stockValueCents: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin";
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
  customers: "/api/admin/customers",
  products: "/api/admin/products",
  inventory: "/api/admin/inventory",
  dashboard: "/api/admin/dashboard",
} as const;
