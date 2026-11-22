import type { Metadata } from "next";
import { AuthLayout } from "@/components/account/AuthLayout";
import { AuthForm } from "@/components/account/AuthForm";
export const metadata: Metadata = { title: "Recuperar senha" };
export default function ResetPage() {
  return (
    <AuthLayout
      title="RECUPERAR SENHA"
      eyebrow="Acesso"
      text="Informe o e-mail da sua conta para receber as instruções."
      crumb="Recuperar senha"
    >
      <AuthForm mode="reset" />
    </AuthLayout>
  );
}