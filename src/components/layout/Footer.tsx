import Link from "next/link";
import { ArrowUpRight, Camera as Instagram } from "lucide-react";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { Newsletter } from "./Newsletter";
import { getStorefrontCategories } from "@/lib/storefront";
import { STORE } from "@/lib/constants";
export async function Footer() {
  const categories = await getStorefrontCategories();
  return (
    <footer className="footer">
      <Container>
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" prefetch={false} aria-label="Tobacco Hemp — início">
              <Logo />
            </Link>
            <p>
              Seu estilo.
              <br />
              Seus essenciais.
            </p>
            <Link href="/contato" prefetch={false} className="footer-social">
              <Instagram size={16} /> {STORE.instagramHandle}{" "}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div>
            <h3>Institucional</h3>
            <Link href="/sobre" prefetch={false}>Sobre nós</Link>
            <Link href="/contato" prefetch={false}>Nossa loja</Link>
            <Link href="/contato" prefetch={false}>Contato</Link>
          </div>
          <div>
            <h3>Ajuda</h3>
            <Link href="/ajuda/trocas" prefetch={false}>Trocas e devoluções</Link>
            <Link href="/ajuda/pagamentos" prefetch={false}>Formas de pagamento</Link>
            <Link href="/ajuda/privacidade" prefetch={false}>Política de privacidade</Link>
            <Link href="/ajuda/termos" prefetch={false}>Termos de uso</Link>
          </div>
          <div>
            <h3>Categorias</h3>
            {categories.map((c) => (
              <Link key={c.slug} href={`/categoria/${c.slug}`} prefetch={false}>
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
