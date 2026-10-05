"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { Container } from "@/components/layout/Container";
export function Hero() {
  const reduced = useReducedMotion();
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
        <motion.div
          className="hero-copy"
          initial={reduced ? false : "hidden"}
          animate="visible"
          variants={staggerContainer}
        >
          <motion.p variants={fadeUp} className="eyebrow">
            Qualidade · Variedade · Sempre com você
          </motion.p>
          <motion.h1 variants={fadeUp} id="hero-title">
            SEU ESTILO.
            <br />
            SEUS <span>ESSENCIAIS.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="hero-text">
            Acessórios que fazem parte da sua rotina.
            <br className="desktop-break" /> Escolha o que vai com você.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link href="/loja?novidades=1" className="button button-primary">
              Ver novidades <ArrowRight size={18} />
            </Link>
          </motion.div>
          <motion.div variants={fadeUp} className="hero-detail">
            <span className="brand-line" />
            <span>Atitude nos detalhes.</span>
          </motion.div>
        </motion.div>
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
