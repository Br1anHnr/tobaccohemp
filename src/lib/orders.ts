import { findProduct } from "@/data/products";
import type { CustomerOrder } from "@/types/account";

export const orderSubtotal = (order: CustomerOrder) =>
  order.items.reduce(
    (sum, item) => sum + (findProduct(item.productId)?.price ?? 0) * item.quantity,
    0,
  );
export const orderTotal = (order: CustomerOrder) =>
  orderSubtotal(order) + order.shipping;
export const orderCount = (order: CustomerOrder) =>
  order.items.reduce((sum, item) => sum + item.quantity, 0);
export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
