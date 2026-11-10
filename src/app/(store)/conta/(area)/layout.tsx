import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { PageIntro } from "@/components/layout/PageIntro";
import { AccountShell } from "@/components/account/AccountShell";
export const metadata: Metadata = {
  title: { default: "Minha conta", template: "%s | Minha conta | Tobacco Hemp" },
};
export default function AccountAreaLayout({ children }: { children: ReactNode }) {
  return (
    <Container className="page-container">
      <PageIntro
        title="MINHA CONTA"
        eyebrow="Área do cliente"
        breadcrumbs={[{ label: "Minha conta" }]}
      />
      <AccountShell>{children}</AccountShell>
    </Container>
  );
}