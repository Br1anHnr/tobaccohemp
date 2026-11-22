import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowDown } from "lucide-react";
import { Container } from "@/components/layout/Container";
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-photo">
        <Image
          src="/products/hero.webp"
          alt="Shoulder bag, case, bandeja e porta-objetos pretos sobre pedra escura, iluminados por uma luz quente"
          fill
          priority
          sizes="(max-width: 767px) 100vw, 70vw"
        />
      </div>
      <div className="hero-shade" />
      <Container>
        <div className="hero-copy">
          <p className="eyebrow">
            Qualidade · Variedade · Sempre com você
          </p>
          <h1 id="hero-title">
            SEU ESTILO.
            <br />
            SEUS <span>ESSENCIAIS.</span>
          </h1>
          <p className="hero-text">
            Acessórios que fazem parte da sua rotina.
            <br className="desktop-break" /> Escolha o que vai com você.
          </p>
          <div>
            <Link
              href="/loja?novidades=1"
              className="button button-primary"
            >
              Ver novidades <ArrowRight size={18} />
            </Link>
          </div>
          <div className="hero-detail">
            <span className="brand-line" />
            <span>Atitude nos detalhes.</span>
          </div>
        </div>
        <div className="hero-index">
          <span>01 / ESSENCIAIS</span>
          <a href="#categorias" aria-label="Explorar categorias">
            <ArrowDown size={18} />
          </a>
        </div>
      </Container>
    </section>
  );
}
