import type { OperationsDashboardMetrics } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";
import { invalid } from "@/shared/server/validation";

export async function operationsDashboard(
  query: URLSearchParams,
  db: Db = pool(),
  sandboxProductIds: string[] | null = null,
): Promise<OperationsDashboardMetrics> {
  const period = Number(query.get("period") ?? 30);
  const interval = query.get("interval") ?? "day";
  if (![7, 30, 90, 365].includes(period) || !["day", "week", "month"].includes(interval)) invalid();

  const result = await db.query<{ metrics: OperationsDashboardMetrics }>(`
    WITH bounds AS (
      SELECT date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') - ($1::int - 1) * interval '1 day' AS starts,
             date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' AS ends
    ), scoped_orders AS (
      SELECT o.*, o.created_at AT TIME ZONE 'America/Sao_Paulo' AS local_created
        FROM orders o
       WHERE NOT o.is_demo
         AND CASE WHEN $3::text[] IS NULL THEN NOT EXISTS (
           SELECT 1 FROM asaas_sandbox_attempts a WHERE a.order_id = o.id
         ) ELSE o.payment_provider = 'asaas' AND EXISTS (
           SELECT 1 FROM asaas_sandbox_attempts a WHERE a.order_id = o.id
         ) END
    ), period_orders AS (
      SELECT o.* FROM scoped_orders o, bounds b WHERE o.local_created >= b.starts AND o.local_created < b.ends
    ), paid_orders AS (
      SELECT o.*, paid_at.at AT TIME ZONE 'America/Sao_Paulo' AS local_paid
        FROM scoped_orders o
        CROSS JOIN LATERAL (
          SELECT max(h.created_at) AS at FROM order_status_history h WHERE h.order_id = o.id AND h.to_status = 'paid'
        ) paid_at
        CROSS JOIN bounds b
       WHERE o.status = 'paid'
         AND ($3::text[] IS NULL OR EXISTS (
           SELECT 1 FROM asaas_sandbox_attempts a
            WHERE a.order_id = o.id AND a.state = 'ready'
              AND a.last_provider_status IN ('CONFIRMED', 'RECEIVED')
         ))
         AND paid_at.at AT TIME ZONE 'America/Sao_Paulo' >= b.starts
         AND paid_at.at AT TIME ZONE 'America/Sao_Paulo' < b.ends
    ), stock AS (
      SELECT p.id, p.name, p.price_cents, coalesce(i.quantity, 0) AS quantity,
             coalesce(i.reorder_point, 0) AS reorder_point
        FROM products p LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.active AND p.archived_at IS NULL AND ($3::text[] IS NULL OR p.id = ANY($3::text[]))
    ), paid_items AS (
      SELECT i.* FROM order_items i JOIN paid_orders o ON o.id = i.order_id
    ), buckets AS (
      SELECT generate_series(date_trunc($2, starts), date_trunc($2, ends - interval '1 day'),
             CASE $2 WHEN 'month' THEN interval '1 month' WHEN 'week' THEN interval '1 week' ELSE interval '1 day' END) AS bucket
        FROM bounds
    ), sales_series AS (
      SELECT date_trunc($2, local_paid) AS bucket, sum(total_cents) / 100.0 AS value FROM paid_orders GROUP BY 1
    ), order_series AS (
      SELECT date_trunc($2, local_created) AS bucket, count(*) AS value FROM period_orders GROUP BY 1
    )
    SELECT jsonb_build_object(
      'customers', (SELECT count(*) FROM customer_accounts c
        WHERE CASE WHEN $3::text[] IS NULL THEN c.password_hash <> 'sandbox-shadow-disabled'
          ELSE NOT starts_with(c.id, 'admin-sandbox-') END),
      'products', (SELECT count(*) FROM stock),
      'units', (SELECT coalesce(sum(quantity), 0) FROM stock),
      'stockValueCents', (SELECT coalesce(sum(price_cents::bigint * quantity), 0) FROM stock),
      'confirmedCents', (SELECT coalesce(sum(total_cents), 0) FROM paid_orders),
      'averagePaidCents', (SELECT round(avg(total_cents)) FROM paid_orders),
      'ordersByStatus', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.status) FROM (
        SELECT status, count(*) FROM period_orders GROUP BY status
      ) s), '[]'),
      'recent', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r."createdAt" DESC, r.id) FROM (
        SELECT id, order_number AS number, status, total_cents AS "totalCents", created_at AS "createdAt"
          FROM period_orders ORDER BY created_at DESC, id LIMIT 10
      ) r), '[]'),
      'lowStock', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.quantity, s.name) FROM (
        SELECT id, name, quantity, reorder_point AS "reorderPoint" FROM stock WHERE quantity <= reorder_point
      ) s), '[]'),
      'bestSellers', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.value DESC, s.label) FROM (
        SELECT max(product_name) AS label, sum(quantity) AS value
          FROM paid_items GROUP BY product_id ORDER BY value DESC, label LIMIT 10
      ) s), '[]'),
      'categoryPerformance', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.value DESC, s.label) FROM (
        SELECT coalesce(c.name, i.category_slug) AS label, sum(i.line_total_cents) / 100.0 AS value
          FROM paid_items i LEFT JOIN categories c ON c.slug = i.category_slug GROUP BY 1
      ) s), '[]'),
      'salesSeries', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'label', to_char(b.bucket, CASE $2 WHEN 'month' THEN 'MM/YY' ELSE 'DD/MM' END),
        'value', coalesce(s.value, 0)) ORDER BY b.bucket)
        FROM buckets b LEFT JOIN sales_series s USING (bucket) WHERE EXISTS (SELECT 1 FROM sales_series)), '[]'),
      'orderSeries', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'label', to_char(b.bucket, CASE $2 WHEN 'month' THEN 'MM/YY' ELSE 'DD/MM' END),
        'value', coalesce(s.value, 0)) ORDER BY b.bucket)
        FROM buckets b LEFT JOIN order_series s USING (bucket) WHERE EXISTS (SELECT 1 FROM order_series)), '[]')
    ) AS metrics
  `, [period, interval, sandboxProductIds]);
  return result.rows[0].metrics;
}
