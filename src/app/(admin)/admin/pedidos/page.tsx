import type { Metadata } from "next";
import { OrdersTable } from "@/components/admin/OrdersTable";

export const metadata: Metadata = {
  title: "Pedidos",
};

export default function AdminOrdersPage() {
  return (
    <>
      <div className="admin-page-head">
        <p className="eyebrow">Comercial</p>
        <h1>
          Pedidos<span className="accent-dot">.</span>
        </h1>
        <p>
          Acompanhe pedidos demonstrativos, itens com preços congelados, status e
          histórico. O gateway de pagamento permanece desacoplado e sem cobranças
          reais.
        </p>
      </div>
      <OrdersTable />
    </>
  );
}
