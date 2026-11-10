import type { Metadata } from "next";
import { OrderHistory } from "@/components/account/OrderHistory";
export const metadata: Metadata = { title: "Meus pedidos" };
export default function OrdersPage() {
  return <OrderHistory />;
}