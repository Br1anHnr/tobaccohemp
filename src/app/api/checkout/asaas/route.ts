import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { customerRoute, jsonInput } from "@/shared/server/customer-http";
import { mutationOrigin } from "@/shared/server/preview";
import { objectInput } from "@/shared/server/validation";
import { addressInput, checkoutContactInput } from "@/modules/customers/domain/customer-account-input";
import { isProductionAdminSandbox } from "@/modules/orders/infrastructure/asaas-client";
import { requireSandboxCustomer } from "@/modules/orders/infrastructure/asaas-customer-access";
import { createSandboxPayment, customerSandboxPayment } from "@/modules/orders/infrastructure/asaas-sandbox";

export const runtime = "nodejs";
export const POST = customerRoute(async (request, account) => {
  await requireSandboxCustomer(account!.id);
  const payload = objectInput(await jsonInput(request), ["items", "paymentMethod", "idempotencyKey", "delivery", "contact"], true);
  const { delivery, contact, ...cart } = payload;
  const production = isProductionAdminSandbox();
  const saved = account!.addresses.find(address => address.isDefault) ?? account!.addresses[0];
  const result = await createSandboxPayment(cart, account!.id, mutationOrigin(request), undefined, {
    callbackPath: production ? "/pedido-confirmado" : "/checkout",
    delivery: delivery === undefined
      ? saved && { label: saved.label, zip: saved.zip, street: saved.street, number: saved.number,
        complement: saved.complement, city: saved.city, state: saved.state }
      : addressInput(delivery),
    contact: contact === undefined
      ? { name: account!.name, email: account!.email, phone: account!.phone }
      : checkoutContactInput(contact),
    prefillSyntheticCustomer: production,
  });
  if (!production) revalidateStorefrontCatalog();
  return customerSandboxPayment(result);
});
