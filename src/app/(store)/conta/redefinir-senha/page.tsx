import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthLayout } from "@/components/account/AuthLayout";
import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";
import { PageSkeleton } from "@/components/ui/Skeleton";
export const metadata: Metadata = { title: "Redefinir senha" };
export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="DEFINA SUA NOVA SENHA"
      eyebrow="Acesso"
      text="Escolha uma nova senha para voltar a acessar sua conta."
      crumb="Redefinir senha"
    >
      <Suspense fallback={<PageSkeleton label="Carregando…" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
