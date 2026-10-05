import { MessageCircle, Layers3, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
const benefits = [
  {
    icon: MessageCircle,
    title: "Atendimento",
    text: "Converse com a gente",
    href: "/contato",
  },
  {
    icon: Layers3,
    title: "Variedade",
    text: "Encontre seu essencial",
    href: "/loja",
  },
  {
    icon: MapPin,
    title: "Loja física",
    text: "Conheça a Tobacco Hemp",
    href: "/contato",
  },
  {
    icon: Sparkles,
    title: "Novidades",
    text: "Um novo detalhe na rotina",
    href: "/loja?novidades=1",
  },
];
export function Benefits() {
  return (
    <section className="benefits" aria-label="Explore a Tobacco Hemp">
      <Container>
        {benefits.map((b) => (
          <Link key={b.title} href={b.href}>
            <b.icon size={27} strokeWidth={1.3} />
            <div>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </div>
          </Link>
        ))}
      </Container>
    </section>
  );
}
