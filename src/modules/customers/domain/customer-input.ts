import type { CustomerInput } from "@/shared/contracts/admin";
import { invalid, objectInput, textInput } from "@/shared/server/validation";

export function customerInput(value: unknown, partial = false): Partial<CustomerInput> {
  const input = objectInput(value, ["name", "email", "status"], partial);
  const result: Partial<CustomerInput> = {};
  if ("name" in input) result.name = textInput(input.name, 120);
  if ("email" in input) {
    result.email = textInput(input.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(result.email)) invalid();
  }
  if ("status" in input) {
    if (input.status !== "active" && input.status !== "inactive") invalid();
    result.status = input.status;
  }
  return result;
}
