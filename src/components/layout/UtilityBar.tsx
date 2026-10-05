import Link from "next/link";
import { MapPin, MessageCircle, Sparkles } from "lucide-react";
import { Container } from "./Container";
export function UtilityBar() {
  return (
    <div className="utility-bar">
      <Container>
        <span>Acessórios para acompanhar sua rotina.</span>
        <div>
          <Link href="/contato">
            <MapPin size={12} /> Loja física
          </Link>
          <Link href="/loja?novidades=1">
            <Sparkles size={12} /> Novidades
          </Link>
          <Link href="/contato">
            <MessageCircle size={12} /> Atendimento
          </Link>
        </div>
      </Container>
    </div>
  );
}
