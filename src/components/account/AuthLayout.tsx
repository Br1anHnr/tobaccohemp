import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";

/** Shared layout for login, sign-up and password recovery screens. */
export function AuthLayout({
  title,
  eyebrow,
  text,
  crumb,
  children,
}: {
  title: string;
  eyebrow: string;
  text: string;
  crumb: string;
  children: ReactNode;
}) {
  return (
    <Container className="page-container">
      <PageIntro
        title={title}
        eyebrow={eyebrow}
        text={text}
        breadcrumbs={[{ label: "Conta", href: "/conta" }, { label: crumb }]}
      />
      <div className="auth-layout">
        <div className="auth-card">{children}</div>
        <aside className="auth-aside">
          <ShieldCheck size={22} aria-hidden="true" />
          <h2>Seus dados protegidos</h2>
          <p>
            Sua senha é armazenada com hash seguro e sua sessão fica em um
            cookie protegido. Nenhuma senha é guardada no navegador.
          </p>
          <p>
            Você continua podendo montar seu carrinho e salvar favoritos neste
            dispositivo.
          </p>
        </aside>
      </div>
    </Container>
  );
}
