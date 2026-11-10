import type { Metadata } from "next";
import { AuthLayout } from "@/components/account/AuthLayout";
import { AuthForm } from "@/components/account/AuthForm";
export const metadata: Metadata = { title: "Criar conta" };
export default function SignUpPage() {
  return (
    <AuthLayout
      title="CRIE SUA CONTA"
      eyebrow="Cadastro"
      text="Acompanhe pedidos e guarde seus essenciais favoritos."
      crumb="Cadastro"
    >
      <AuthForm mode="signup" />
    </AuthLayout>
  );
}