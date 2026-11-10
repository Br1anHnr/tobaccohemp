import type { AdminProduct, StockStatus } from "@/types/admin";
import { products } from "@/data/products";

/**
 * Dados demonstrativos de gestão de produtos e estoque.
 * O estoque parte do catálogo local (`src/data/products`) e os números
 * de vendas e receita são fictícios, gerados apenas para a demonstração.
 */
const soldByProduct: Record<string, number> = {
  "case-01": 34,
  "bag-01": 22,
  "tray-01": 41,
  "org-01": 57,
  "case-02": 28,
  "bag-02": 19,
  "kit-01": 15,
  "tray-02": 46,
  "org-02": 24,
  "kit-02": 11,
};

export const LOW_STOCK_AT = 6;

export function stockStatusFor(stock: number): StockStatus {
  if (stock <= 0) return "esgotado";
  if (stock <= LOW_STOCK_AT) return "baixo";
  return "em_estoque";
}

export const adminProducts: AdminProduct[] = products.map((product) => {
  const sold = soldByProduct[product.id] ?? 0;
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    categorySlug: product.categorySlug,
    price: product.price,
    stock: product.stock,
    sold,
    revenue: Math.round(sold * product.price * 100) / 100,
    status: stockStatusFor(product.stock),
  };
});
