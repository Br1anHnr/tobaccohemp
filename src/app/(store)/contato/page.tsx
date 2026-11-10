import {
  MessageCircle,
  Camera as Instagram,
  MapPin,
  Clock3,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { STORE } from "@/lib/constants";
export const metadata = { title: "Contato" };
export default function Page() {
  const contacts = [
    {
      icon: MessageCircle,
      title: "WhatsApp",
      value: STORE.whatsapp || "Número a confirmar com a loja",
      href: STORE.whatsapp
        ? `https://wa.me/${STORE.whatsapp.replace(/\D/g, "")}`
        : "",
    },
    {
      icon: Instagram,
      title: "Instagram",
      value: STORE.instagramHandle,
      href: STORE.instagramUrl,
    },
    {
      icon: MapPin,
      title: "Loja física",
      value: STORE.address || "Endereço a confirmar com a loja",
      href: "",
    },
    {
      icon: Clock3,
      title: "Horário",
      value: STORE.hours || "Horário de atendimento a confirmar",
      href: "",
    },
  ];
  return (
    <Container className="page-container">
      <PageIntro
        title="CONVERSE COM A GENTE"
        text="Dúvidas sobre um acessório ou sobre sua próxima escolha?"
        eyebrow="Estamos por perto"
        breadcrumbs={[{ label: "Contato" }]}
      />
      <div className="contact-grid">
        {contacts.map((c) => (
          <section key={c.title}>
            <c.icon size={28} strokeWidth={1.3} />
            <h2>{c.title}</h2>
            {c.href ? (
              <a href={c.href} target="_blank" rel="noopener noreferrer">
                {c.value} ↗
              </a>
            ) : (
              <p>{c.value}</p>
            )}
          </section>
        ))}
      </div>
    </Container>
  );
}
