import type { Customer, AdminProduct, AdminProductImage, DashboardMetrics } from "@/types/admin";
import { currency } from "@/lib/currency";
import { adminEndpoints } from "@/shared/contracts/admin";
import type {
  AdminUser, Customer as WireCustomer, Product, ProductInput, InventoryItem,
  DashboardMetrics as WireMetrics, DataResponse, LoginInput, Category, CategoryInput,
} from "@/shared/contracts/admin";
import type {
  CreateOrderInput,
  Order,
  OrderDetail,
  UpdateOrderStatusInput,
} from "@/shared/contracts/orders";

export const sessionExpiredEvent = "th-admin-session-expired";

export class AdminApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, options: RequestInit = {}, expire = true): Promise<T> {
  const response = await fetch(path, { ...options, credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && expire && typeof window !== "undefined") {
      window.dispatchEvent(new Event(sessionExpiredEvent));
    }
    throw new AdminApiError(response.status,
      typeof body?.error?.message === "string" ? body.error.message : "Não foi possível acessar o backend local.");
  }
  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new AdminApiError(502, "Resposta inválida do backend local.");
  }
  return (body as DataResponse<T>).data;
}

export const fetchAdminSession = () => request<AdminUser | null>(adminEndpoints.session);
export const loginAdmin = (input: LoginInput) => request<AdminUser>(adminEndpoints.login, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
}, false);
export const logoutAdmin = () => request<null>(adminEndpoints.logout, { method: "POST" });

export async function fetchCustomers(): Promise<Customer[]> {
  const rows = await request<WireCustomer[]>(adminEndpoints.customers);
  return rows.map(row => ({
    id: row.id, name: row.name, email: row.email, joinedAt: row.createdAt,
    status: row.status === "active" ? "ativo" : "inativo",
    city: "Não informado", phone: "—", orders: null, spent: null,
  }));
}

export async function fetchProducts(): Promise<AdminProduct[]> {
  const [products, inventory] = await Promise.all([
    request<Product[]>(adminEndpoints.products), request<InventoryItem[]>(adminEndpoints.inventory),
  ]);
  return products.map(product => {
    const item = inventory.find(row => row.productId === product.id);
    if (!item) throw new AdminApiError(502, "Estoque indisponível para um produto.");
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      brand: product.brand,
      category: product.categoryName ?? "Sem categoria",
      categorySlug: product.categorySlug ?? "sem-categoria",
      price: product.priceCents / 100,
      stock: item.quantity,
      reorderPoint: item.reorderPoint,
      sold: null, revenue: null,
      sku: product.sku,
      active: product.active,
      archived: product.archived,
      isNew: product.isNew,
      isFeatured: product.isFeatured,
      variants: product.variants,
      tags: product.tags,
      images: product.images,
      status: item.quantity === 0 ? "esgotado" : item.quantity <= item.reorderPoint ? "baixo" : "em_estoque",
    };
  });
}

export const updateStock = (id: string, quantity: number, reorderPoint: number) =>
  request<InventoryItem>(`${adminEndpoints.inventory}/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity, reorderPoint }),
  });

export const createProduct = (input: ProductInput) =>
  request<Product>(adminEndpoints.products, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const updateProduct = (id: string, input: ProductInput) =>
  request<Product>(`${adminEndpoints.products}/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const archiveProduct = (id: string) =>
  request<Product>(`${adminEndpoints.products}/${encodeURIComponent(id)}`, { method: "DELETE" });

export const fetchCategories = () => request<Category[]>(adminEndpoints.categories);

export const createCategory = (input: CategoryInput) =>
  request<Category>(adminEndpoints.categories, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const fetchOrders = () => request<Order[]>(adminEndpoints.orders);

export const fetchOrderDetail = (id: string) =>
  request<OrderDetail>(`${adminEndpoints.orders}/${encodeURIComponent(id)}`);

export const createAdminOrder = (input: CreateOrderInput) =>
  request<OrderDetail>(adminEndpoints.orders, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const updateCategory = (slug: string, input: Partial<CategoryInput>) =>
  request<Category>(`${adminEndpoints.categories}/${encodeURIComponent(slug)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const updateOrderStatus = (id: string, input: UpdateOrderStatusInput) =>
  request<OrderDetail>(`${adminEndpoints.orders}/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const deleteCategory = (slug: string) =>
  request<null>(`${adminEndpoints.categories}/${encodeURIComponent(slug)}`, { method: "DELETE" });

export async function uploadProductImage(productId: string, file: File, alt = ""): Promise<AdminProductImage> {
  const form = new FormData();
  form.set("file", file);
  form.set("alt", alt);
  const image = await request<AdminProductImage>(
    `${adminEndpoints.products}/${encodeURIComponent(productId)}/images`,
    { method: "POST", body: form },
  );
  return { id: image.id, url: image.url, alt: image.alt, position: image.position };
}

export const reorderProductImages = (productId: string, images: { id: string; position: number }[]) =>
  request<AdminProductImage[]>(`${adminEndpoints.products}/${encodeURIComponent(productId)}/images`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });

export const deleteProductImage = (productId: string, imageId: string) =>
  request<null>(`${adminEndpoints.products}/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`, {
    method: "DELETE",
  });

export async function replaceProductImage(productId: string, imageId: string, file: File): Promise<AdminProductImage> {
  const form = new FormData();
  form.set("file", file);
  const image = await request<AdminProductImage>(
    `${adminEndpoints.products}/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
    { method: "PATCH", body: form },
  );
  return { id: image.id, url: image.url, alt: image.alt, position: image.position };
}
export async function fetchDashboard(): Promise<DashboardMetrics> {
  const [metrics, products] = await Promise.all([
    request<WireMetrics>(adminEndpoints.dashboard), fetchProducts(),
  ]);
  const hint = "Dados sintéticos — sem histórico comparativo";
  return {
    kpis: [
      { id: "revenue", label: "Valor em estoque", value: currency(metrics.stockValueCents / 100), delta: null, direction: "up", hint },
      { id: "orders", label: "Produtos cadastrados", value: String(metrics.products), delta: null, direction: "up", hint },
      { id: "customers", label: "Clientes cadastrados", value: String(metrics.customers), delta: null, direction: "up", hint },
      { id: "conversion", label: "Unidades em estoque", value: String(metrics.units), delta: null, direction: "up", hint },
    ],
    salesSeries: [], categoryPerformance: [],
    lowStock: products.filter(product => product.active && !product.archived && product.stock <= (product.reorderPoint ?? 0)),
  };
}
