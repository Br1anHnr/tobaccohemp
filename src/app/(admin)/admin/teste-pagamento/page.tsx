import type { Metadata } from "next";
import { AdminSandboxCheckout } from "@/components/admin/AdminSandboxCheckout";

export const metadata: Metadata = {
  title: "Teste de pagamento (Sandbox)",
};

export default function AdminSandboxCheckoutPage() {
  return (
    <>
      <div className="admin-page-head">
        <p className="eyebrow">Área restrita a administrador</p>
        <h1>Teste de pagamento</h1>
        <p>
          Fluxo integrado com Asaas Sandbox e estoque sintético em banco isolado. Endereços de entrega seguem a conta do cliente sem gerar pedidos comerciais no banco principal.
        </p>
      </div>
      <AdminSandboxCheckout />
    </>
  );
}
