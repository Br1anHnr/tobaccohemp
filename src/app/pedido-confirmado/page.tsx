import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { OrderConfirmation } from "@/components/commerce/OrderConfirmation";
export const metadata: Metadata = { title: "Confirmação do pedido" };
export default function Page() {
  return (
    <Container className="page-container">
      <OrderConfirmation />
    </Container>
  );
}
