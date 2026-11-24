import { ASAAS_SANDBOX } from "@/lib/constants";
import { sandboxPool } from "@/shared/server/database";
import { ensureSandboxSchema } from "@/shared/server/migrate";
import { AdminError } from "@/shared/server/validation";
import { isProductionAdminSandbox, sandboxEnabled } from "./asaas-client";

export async function sandboxCustomerAllowed(accountId: string): Promise<boolean> {
  if (sandboxEnabled()) return true;
  if (!isProductionAdminSandbox() || accountId.startsWith("admin-sandbox-")) return false;
  await ensureSandboxSchema();
  // The order number is unique in the isolated database. Only a verified paid
  // card attempt linked to the authenticated account can grant this entitlement.
  const result = await sandboxPool().query(
    `SELECT 1 FROM orders o
       JOIN asaas_sandbox_attempts a ON a.order_id = o.id
      WHERE upper(o.order_number) = $1
        AND o.customer_account_id = $2
        AND o.payment_provider = 'asaas' AND NOT o.is_demo
        AND o.status = 'paid' AND o.payment_method = 'card'
        AND a.method = 'card' AND a.provider_id IS NOT NULL AND a.payment_id IS NOT NULL`,
    [ASAAS_SANDBOX.authorizedCustomerOrder, accountId],
  );
  return result.rowCount === 1;
}

export async function requireSandboxCustomer(accountId: string) {
  if (!(await sandboxCustomerAllowed(accountId))) {
    throw new AdminError(403, "SANDBOX_ACCESS_DENIED", "Teste de pagamento indisponível para esta conta.");
  }
}
