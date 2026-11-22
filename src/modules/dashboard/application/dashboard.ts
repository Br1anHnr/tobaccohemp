import type {
  DashboardMetrics,
  DashboardSeriesPoint,
} from "@/shared/contracts/admin";
import { listCustomers } from "@/modules/customers";
import { listProducts } from "@/modules/catalog";
import { listInventory } from "@/modules/inventory";
import { pool, type Db } from "@/shared/server/database";
import { invalid } from "@/shared/server/validation";

/** Trailing window (in days) used for the demonstrative order volume series. */
const SERIES_DAYS = 14;
/** Statuses that carry a demonstrative monetary commitment (matching the orders panel). */
const COMMITTED_STATUSES = ["paid", "pending_payment"];

function centsToReais(cents: unknown): number {
  return Number((Number(cents) / 100).toFixed(2));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Daily demonstrative order volume over the trailing window. Returns an empty
 * series when there is no qualifying demonstrative order in the window, so the
 * dashboard shows an explicit empty state instead of a fabricated trend.
 */
async function demoVolumeSeries(db: Db): Promise<DashboardSeriesPoint[]> {
  const result = await db.query(
    `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            SUM(total_cents)::bigint AS cents
       FROM orders
      WHERE is_demo = true
        AND status = ANY($1::text[])
        AND created_at >= now() - ($2 || ' days')::interval
      GROUP BY 1
      ORDER BY 1`,
    [COMMITTED_STATUSES, String(SERIES_DAYS)],
  );
  if (result.rows.length === 0) return [];

  const byDay = new Map<string, number>();
  for (const row of result.rows) {
    byDay.set(String(row.day), Number(row.cents));
  }

  const today = new Date();
  const points: DashboardSeriesPoint[] = [];
  for (let offset = SERIES_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = isoDay(date);
    const cents = byDay.get(key) ?? 0;
    points.push({
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value: centsToReais(cents),
    });
  }
  return points;
}

/** Demonstrative order volume grouped by category, highest volume first. */
async function demoCategoryPerformance(db: Db): Promise<DashboardSeriesPoint[]> {
  const result = await db.query(
    `SELECT COALESCE(c.name, oi.category_slug) AS label, SUM(oi.line_total_cents)::bigint AS cents
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN categories c ON c.slug = oi.category_slug
      WHERE o.is_demo = true
        AND o.status = ANY($1::text[])
      GROUP BY COALESCE(c.name, oi.category_slug)
      ORDER BY cents DESC`,
    [COMMITTED_STATUSES],
  );
  return result.rows.map(row => ({
    label: String(row.label),
    value: centsToReais(row.cents),
  }));
}

export async function dashboardMetrics(db: Db = pool()): Promise<DashboardMetrics> {
  const [products, inventory, salesSeries, categoryPerformance] = await Promise.all([
    listProducts(db),
    listInventory(db),
    demoVolumeSeries(db),
    demoCategoryPerformance(db),
  ]);
  const active = products.filter(product => product.active && !product.archived);
  const metrics = {
    customers: (await listCustomers(db)).length,
    products: products.length,
    units: inventory.reduce((total, item) => total + item.quantity, 0),
    lowStockProducts: active.filter(product => inventory.some(item => item.productId === product.id && item.quantity <= item.reorderPoint)).length,
    stockValueCents: active.reduce((total, product) => total + product.priceCents * (inventory.find(item => item.productId === product.id)?.quantity ?? 0), 0),
    salesSeries,
    categoryPerformance,
  };
  if (!Number.isSafeInteger(metrics.units) || !Number.isSafeInteger(metrics.stockValueCents)) invalid();
  return metrics;
}
