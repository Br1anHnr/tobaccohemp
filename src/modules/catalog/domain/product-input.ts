import type { ProductInput } from "@/shared/contracts/admin";
import { integerInput, invalid, objectInput, textInput } from "@/shared/server/validation";

export function productInput(value: unknown, partial = false): Partial<ProductInput> {
  const input = objectInput(value, ["sku", "name", "priceCents", "active"], partial);
  const result: Partial<ProductInput> = {};
  if ("name" in input) result.name = textInput(input.name, 120);
  if ("sku" in input) {
    result.sku = textInput(input.sku, 64).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]*$/u.test(result.sku)) invalid();
  }
  if ("priceCents" in input) result.priceCents = integerInput(input.priceCents);
  if ("active" in input) {
    if (typeof input.active !== "boolean") invalid();
    result.active = input.active;
  }
  return result;
}
