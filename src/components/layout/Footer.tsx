import Link from "next/link";
import { ArrowUpRight, Camera as Instagram } from "lucide-react";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { Newsletter } from "./Newsletter";
import { categories } from "@/data/categories";
import { STORE } from "@/lib/constants";
export function Footer() {
  return (
    <footer className="footer">
      <Container>
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" aria-label="Tobacco Hemp — início">
              <Logo />
            </Link>
            <p>
              Seu estilo.
              <br />
              Seus essenciais.
            </p>
            <Link href="/contato" className="footer-social">
              <Instagram size={16} /> {STORE.instagramHandle}{" "}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div>
            <h3>Institucional</h3>
            <Link href="/sobre">Sobre nós</Link>
            <Link href="/contato">Nossa loja</Link>
            <Link href="/contato">Contato</Link>
          </div>
          <div>
            <h3>Ajuda</h3>
            <Link href="/ajuda/trocas">Trocas e devoluções</Link>
            <Link href="/ajuda/pagamentos">Formas de pagamento</Link>
            <Link href="/ajuda/privacidade">Política de privacidade</Link>
            <Link href="/ajuda/termos">Termos de uso</Link>
          </div>
          <div>
            <h3>Categorias</h3>
            {categories.map((c) => (
              <Link key={c.slug} href={`/categoria/${c.slug}`}>
                {c.name}
              </Link>
            ))}
          </div>
          <Newsletter />
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Tobacco Hemp. Todos os direitos
            reservados.
          </p>
          <span>Feito para acompanhar o seu estilo.</span>
        </div>
      </Container>
    </footer>
  );
}
