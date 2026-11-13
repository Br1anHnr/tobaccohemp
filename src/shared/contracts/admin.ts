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
  categories: "/api/admin/categories",
  inventory: "/api/admin/inventory",
  dashboard: "/api/admin/dashboard",
} as const;
