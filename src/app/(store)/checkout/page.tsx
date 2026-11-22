import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { CheckoutForm } from "@/components/commerce/CheckoutForm";
import { sandboxEnabled } from "@/modules/orders/infrastructure/asaas-client";

export const metadata: Metadata = { title: "Checkout" };
export const revalidate = 60;

export default function Page() {
  return (
    <Container className="page-container">
      <PageIntro
        title="FINALIZAR PEDIDO"
        eyebrow="Checkout"
        breadcrumbs={[
          { label: "Carrinho", href: "/carrinho" },
          { label: "Checkout" },
        ]}
      />
      <CheckoutForm initialSandboxAvailable={sandboxEnabled()} />
    </Container>
  );
}
