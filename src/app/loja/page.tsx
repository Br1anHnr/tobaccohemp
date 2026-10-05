import { Suspense } from "react";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { Catalog } from "@/components/commerce/Catalog";
export const metadata: Metadata = {
  title: "Loja",
  description:
    "Encontre acessórios para a sua rotina. Cases, shoulder bags, bandejas e organizadores.",
};
export default function ShopPage() {
  return (
    <Container className="page-container">
      <PageIntro
        title="SEUS PRÓXIMOS ESSENCIAIS"
        text="Escolha os detalhes que acompanham o seu estilo."
        eyebrow="Explore a seleção"
        breadcrumbs={[{ label: "Loja" }]}
      />
      <Suspense fallback={<p role="status">Carregando catálogo…</p>}>
        <Catalog />
      </Suspense>
    </Container>
  );
}
