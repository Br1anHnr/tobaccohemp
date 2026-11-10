import type { Metadata } from "next";
import { AuthLayout } from "@/components/account/AuthLayout";
import { AuthForm } from "@/components/account/AuthForm";
export const metadata: Metadata = { title: "Entrar" };
export default function SignInPage() {
  return (
    <AuthLayout
      title="BOM TE VER"
      eyebrow="Entrar"
      text="Acesse seus pedidos, dados e favoritos."
      crumb="Entrar"
    >
      <AuthForm mode="signin" />
    </AuthLayout>
  );
}