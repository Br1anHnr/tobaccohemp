import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { CheckoutForm } from "@/components/commerce/CheckoutForm";
export const metadata: Metadata = { title: "Checkout demonstrativo" };
export default function Page() {
  return (
    <Container className="page-container">
      <PageIntro
        title="QUASE LÁ"
        eyebrow="Checkout demonstrativo"
        breadcrumbs={[
          { label: "Carrinho", href: "/carrinho" },
          { label: "Checkout" },
        ]}
      />
      <CheckoutForm />
    </Container>
  );
}
