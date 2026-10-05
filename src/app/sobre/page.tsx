import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { ButtonLink } from "@/components/ui/Button";
export const metadata = { title: "Sobre nós" };
export default function Page() {
  return (
    <Container className="page-container">
      <PageIntro
        title="ATITUDE NOS DETALHES"
        eyebrow="Sobre a Tobacco Hemp"
        breadcrumbs={[{ label: "Sobre nós" }]}
      />
      <div className="editorial-layout">
        <div className="editorial-photo">
          <Image
            src="/products/hero.webp"
            alt="Acessórios de uso diário sobre uma composição de pedra preta"
            fill
            sizes="(max-width: 767px) 100vw, 50vw"
          />
        </div>
        <div className="editorial-copy">
          <h2>
            Seu estilo encontra
            <br />
            seus essenciais.
          </h2>
          <p>
            A Tobacco Hemp é uma loja focada em variedade, novidades, acessórios
            e experiência de compra.
          </p>
          <p>
            Do case que organiza seus objetos à bolsa que acompanha seu dia,
            nossa seleção reúne pequenos detalhes para a sua rotina.
          </p>
          <ButtonLink href="/loja">Conhecer a seleção</ButtonLink>
        </div>
      </div>
    </Container>
  );
}
