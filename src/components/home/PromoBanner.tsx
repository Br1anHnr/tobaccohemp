import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
export function PromoBanner() {
  return (
    <section className="promo-section">
      <Container>
        <Reveal className="promo-banner">
          <Image src="/products/hero.webp" alt="" fill sizes="100vw" />
          <div className="promo-copy">
            <p className="eyebrow">Tudo no seu lugar</p>
            <h2>
              TUDO PARA
              <br />
              SUA <span>ROTINA.</span>
            </h2>
            <p>
              Os acessórios certos, juntos.
              <br />
              Conheça nossas combinações de essenciais.
            </p>
            <ButtonLink href="/categoria/kits" variant="secondary">
              Conferir kits
            </ButtonLink>
          </div>
          <span className="promo-caption">Organize. Leve. Repita.</span>
        </Reveal>
      </Container>
    </section>
  );
}
