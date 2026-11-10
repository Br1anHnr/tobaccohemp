import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { CartPage } from "@/components/commerce/CartPage";
export const metadata: Metadata = { title: "Carrinho" };
export default function Page() {
  return (
    <Container className="page-container">
      <PageIntro title="SUA SELEÇÃO" breadcrumbs={[{ label: "Carrinho" }]} />
      <CartPage />
    </Container>
  );
}
