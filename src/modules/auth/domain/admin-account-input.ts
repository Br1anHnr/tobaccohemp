import type { AdminAccountInput, AdminAccountPatch, AdminRole } from "@/shared/contracts/admin";
import { invalid, objectInput, textInput } from "@/shared/server/validation";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const roles: AdminRole[] = ["admin", "operator"];

function emailInput(value: unknown): string {
  const email = textInput(value, 254).toLowerCase();
  if (!emailRe.test(email)) invalid();
  return email;
}

function roleInput(value: unknown): AdminRole {
  if (typeof value !== "string" || !roles.includes(value as AdminRole)) invalid();
  return value as AdminRole;
}

/** Strict password policy for new/changed admin passwords. */
function passwordInput(value: unknown): string {
  if (typeof value !== "string") invalid();
  if (value.length < 12 || value.length > 128) invalid();
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) invalid();
  if (/[\u0000-\u001f\u007f]/u.test(value)) invalid();
  return value;
}

export function adminAccountInput(value: unknown): AdminAccountInput {
  const input = objectInput(value, ["name", "email", "password", "role"]);
  return {
    name: textInput(input.name, 120),
    email: emailInput(input.email),
    password: passwordInput(input.password),
    role: roleInput(input.role),
  };
}

export function adminAccountPatch(value: unknown): AdminAccountPatch {
  const input = objectInput(value, ["name", "role", "active", "password"], true);
  const patch: AdminAccountPatch = {};
  if ("name" in input) patch.name = textInput(input.name, 120);
  if ("role" in input) patch.role = roleInput(input.role);
  if ("active" in input) {
    if (typeof input.active !== "boolean") invalid();
    patch.active = input.active;
  }
  if ("password" in input) patch.password = passwordInput(input.password);
  return patch;
}
