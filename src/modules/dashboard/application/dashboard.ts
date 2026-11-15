import type { DashboardMetrics } from "@/shared/contracts/admin";
import { listCustomers } from "@/modules/customers";
import { listProducts } from "@/modules/catalog";
import { listInventory } from "@/modules/inventory";
import { pool, type Db } from "@/shared/server/database";
import { invalid } from "@/shared/server/validation";

export async function dashboardMetrics(db: Db = pool()): Promise<DashboardMetrics> {
  const products = await listProducts(db);
  const inventory = await listInventory(db);
  const active = products.filter(product => product.active && !product.archived);
  const metrics = {
    customers: (await listCustomers(db)).length, products: products.length,
    units: inventory.reduce((total, item) => total + item.quantity, 0),
    lowStockProducts: active.filter(product => inventory.some(item => item.productId === product.id && item.quantity <= item.reorderPoint)).length,
    stockValueCents: active.reduce((total, product) => total + product.priceCents * (inventory.find(item => item.productId === product.id)?.quantity ?? 0), 0),
  };
  if (!Number.isSafeInteger(metrics.units) || !Number.isSafeInteger(metrics.stockValueCents)) invalid();
  return metrics;
}
