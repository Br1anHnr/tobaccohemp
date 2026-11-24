import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { OrderConfirmation } from "@/components/commerce/OrderConfirmation";
export const metadata: Metadata = { title: "Confirmação do pedido" };
export default function Page() {
  return (
    <Container className="page-container">
      <Suspense fallback={<p role="status">Carregando pedido…</p>}><OrderConfirmation /></Suspense>
    </Container>
  );
}
