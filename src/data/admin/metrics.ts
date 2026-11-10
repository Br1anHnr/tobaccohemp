import type { DashboardMetrics } from "@/types/admin";
import { adminProducts } from "./products";

/**
 * Indicadores e séries demonstrativas para o dashboard.
 * Todos os valores são fictícios e servem apenas para a composição visual.
 */
export const dashboardMetrics: DashboardMetrics = {
  kpis: [
    {
      id: "revenue",
      label: "Receita (30 dias)",
      value: "R$ 48.920",
      delta: 12.4,
      direction: "up",
      hint: "em relação aos 30 dias anteriores",
    },
    {
      id: "orders",
      label: "Pedidos",
      value: "312",
      delta: 8.1,
      direction: "up",
      hint: "em relação ao período anterior",
    },
    {
      id: "customers",
      label: "Clientes ativos",
      value: "87",
      delta: 3.2,
      direction: "up",
      hint: "novos clientes no período",
    },
    {
      id: "conversion",
      label: "Conversão",
      value: "3,8%",
      delta: 0.4,
      direction: "down",
      hint: "em relação ao período anterior",
    },
  ],
  salesSeries: [
    { label: "D1", value: 1820 },
    { label: "D2", value: 2450 },
    { label: "D3", value: 2180 },
    { label: "D4", value: 2940 },
    { label: "D5", value: 2690 },
    { label: "D6", value: 3480 },
    { label: "D7", value: 3120 },
    { label: "D8", value: 3610 },
    { label: "D9", value: 3390 },
    { label: "D10", value: 4020 },
    { label: "D11", value: 4280 },
    { label: "D12", value: 3970 },
    { label: "D13", value: 4520 },
    { label: "D14", value: 4890 },
  ],
  categoryPerformance: [
    { label: "Cases", value: 14200 },
    { label: "Bags", value: 11980 },
    { label: "Bandejas", value: 8460 },
    { label: "Organiz.", value: 7620 },
    { label: "Kits", value: 6660 },
  ],
  lowStock: adminProducts
    .filter((product) => product.status === "baixo" || product.status === "esgotado")
    .slice()
    .sort((a, b) => a.stock - b.stock),
};
