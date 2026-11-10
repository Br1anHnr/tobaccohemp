"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Info, LayoutGrid, LogOut, Package, UserRound, Heart } from "lucide-react";
import { useAccount } from "@/store/account-store";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageSkeleton } from "@/components/ui/Skeleton";

const links = [
  { href: "/conta", label: "Visão geral", icon: LayoutGrid },
  { href: "/conta/pedidos", label: "Meus pedidos", icon: Package },
  { href: "/conta/perfil", label: "Dados cadastrais", icon: UserRound },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
];

/** Guards the customer area and renders its navigation. */
export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { demo, hydrated, startDemo, endDemo, profile } = useAccount();

  if (!hydrated) return <PageSkeleton label="Carregando sua conta…" />;

  if (!demo)
    return (
      <div className="account-gate">
        <UserRound size={38} strokeWidth={1} aria-hidden="true" />
        <h2>Entre para acessar sua conta.</h2>
        <p>
          A autenticação de clientes ainda não está ativa. Você pode conhecer a
          área do cliente com dados demonstrativos.
        </p>
        <div className="account-gate-actions">
          <ButtonLink href="/conta/entrar">Entrar</ButtonLink>
          <Button variant="secondary" onClick={startDemo}>
            Ver área demonstrativa
          </Button>
        </div>
        <Link href="/conta/cadastro" className="text-link">
          Criar conta
        </Link>
      </div>
    );

  return (
    <div className="account-layout">
      <aside className="account-sidebar">
        <p className="account-hello">
          Olá, <strong>{profile.name.split(" ")[0]}</strong>
        </p>
        <nav aria-label="Área do cliente">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="account-signout"
          onClick={() => {
            endDemo();
            router.push("/conta/entrar");
          }}
        >
          <LogOut size={17} aria-hidden="true" /> Sair da demonstração
        </button>
      </aside>
      <div className="account-content">
        <div className="demo-note" role="note">
          <Info size={17} aria-hidden="true" />
          <p>
            Área do cliente demonstrativa. Os dados e pedidos exibidos são
            fictícios e nada é enviado a um servidor.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
