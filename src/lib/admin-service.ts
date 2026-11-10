import type { Customer, AdminProduct, DashboardMetrics } from "@/types/admin";
import { currency } from "@/lib/currency";
import { adminEndpoints } from "@/types/golden-admin";
import type {
  AdminUser, Customer as WireCustomer, Product, InventoryItem,
  DashboardMetrics as WireMetrics, DataResponse, LoginInput,
} from "@/types/golden-admin";

export const sessionExpiredEvent = "golden-admin-session-expired";

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
      id: product.id, name: product.name, sku: product.sku, active: product.active,
      category: "Sem categoria", categorySlug: "sem-categoria", price: product.priceCents / 100,
      stock: item.quantity, reorderPoint: item.reorderPoint, sold: null, revenue: null,
      status: item.quantity === 0 ? "esgotado" : item.quantity <= item.reorderPoint ? "baixo" : "em_estoque",
    };
  });
}

export const updateStock = (id: string, quantity: number, reorderPoint: number) =>
  request<InventoryItem>(`${adminEndpoints.inventory}/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity, reorderPoint }),
  });

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
    lowStock: products.filter(product => product.active && product.stock <= (product.reorderPoint ?? 0)),
  };
}
