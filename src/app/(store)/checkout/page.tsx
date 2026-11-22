import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { CheckoutForm } from "@/components/commerce/CheckoutForm";
export const metadata: Metadata = { title: "Checkout" };
export default function Page() {
  return (
    <Container className="page-container">
      <PageIntro
        title="FINALIZAR PEDIDO"
        eyebrow="Pedido de teste"
        breadcrumbs={[
          { label: "Carrinho", href: "/carrinho" },
          { label: "Checkout" },
        ]}
      />
      <CheckoutForm />
    </Container>
  );
}
