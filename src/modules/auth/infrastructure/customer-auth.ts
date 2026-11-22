import { createHash } from "node:crypto";
import type { CustomerAccount, CustomerAddress } from "@/shared/contracts/customer";
import { pool, type Db } from "@/shared/server/database";
import { AdminError, duplicate } from "@/shared/server/validation";
import { addressInput, profileInput, resetInput, signInInput, signUpInput } from "@/modules/customers/domain/customer-account-input";
import * as accounts from "@/modules/customers/infrastructure/customer-accounts";
import { hashPassword, verifyPassword } from "@/modules/customers/infrastructure/password";
import { localAuthEnabled } from "@/shared/server/preview";
import { deliverPasswordReset, passwordMailEndpoint } from "./password-mail";

export const customerSessionCookie = "th_customer_session";
export const customerSessionSeconds = 7 * 24 * 60 * 60; // 7 days
export const passwordResetSeconds = 30 * 60; // 30 minutes

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function toAccount(record: accounts.CustomerRecord, addresses: CustomerAddress[]): CustomerAccount {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    city: record.city,
    state: record.state,
    addresses,
    createdAt: record.createdAt,
  };
}

/** Per-email login throttling (in-memory; sufficient for the local backend). */
interface AttemptState { attempts: Map<string, number[]> }
const globalState = globalThis as typeof globalThis & { tobaccoHempCustomerAuth?: AttemptState };
const state: AttemptState = globalState.tobaccoHempCustomerAuth ??= { attempts: new Map<string, number[]>() };

function throttle(email: string): void {
  const now = Date.now();
  const list = (state.attempts.get(email) ?? []).filter(t => now - t < 15 * 60_000);
  if (list.length >= 5) throw new AdminError(429, "RATE_LIMIT", "Muitas tentativas. Aguarde antes de tentar novamente.");
  list.push(now);
  state.attempts.set(email, list);
}

export async function signUpCustomer(value: unknown, db: Db = pool()): Promise<{ account: CustomerAccount; token: string }> {
  const input = signUpInput(value);
  if (await accounts.findCustomerByEmail(input.email, db)) duplicate();
  const record = await accounts.createCustomerAccount(
    { name: input.name, email: input.email, phone: input.phone, passwordHash: await hashPassword(input.password) },
    db,
  );
  const token = accounts.newOpaqueToken();
  await accounts.createCustomerSession(record.id, sha256(token), new Date(Date.now() + customerSessionSeconds * 1000), db);
  return { account: toAccount(record, []), token };
}

export async function signInCustomer(value: unknown, db: Db = pool()): Promise<{ account: CustomerAccount; token: string }> {
  const input = signInInput(value);
  throttle(input.email);
  const record = await accounts.findCustomerByEmail(input.email, db);
  const valid = record ? await verifyPassword(input.password, record.passwordHash) : false;
  if (!record || !valid) throw new AdminError(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");
  const token = accounts.newOpaqueToken();
  await accounts.createCustomerSession(record.id, sha256(token), new Date(Date.now() + customerSessionSeconds * 1000), db);
  const addresses = await accounts.listCustomerAddresses(record.id, db);
  return { account: toAccount(record, addresses), token };
}

export async function customerSessionUser(token: string | undefined, db: Db = pool()): Promise<CustomerAccount | null> {
  if (!token) return null;
  const hash = sha256(token);
  const session = await accounts.findCustomerSession(hash, db);
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await accounts.deleteCustomerSession(hash, db);
    return null;
  }
  return toAccount(session.account, session.addresses);
}

export async function invalidateCustomerSession(token: string | undefined, db: Db = pool()): Promise<void> {
  if (token) await accounts.deleteCustomerSession(sha256(token), db);
}

export async function updateCustomerProfile(accountId: string, value: unknown, db: Db = pool()): Promise<CustomerAccount> {
  const record = await accounts.updateCustomerProfile(accountId, profileInput(value), db);
  const addresses = await accounts.listCustomerAddresses(accountId, db);
  return toAccount(record, addresses);
}

export async function listCustomerAccountAddresses(accountId: string, db: Db = pool()): Promise<CustomerAddress[]> {
  return accounts.listCustomerAddresses(accountId, db);
}

export async function createCustomerAccountAddress(
  accountId: string,
  value: unknown,
  db: Db = pool(),
): Promise<{ address: CustomerAddress; addresses: CustomerAddress[] }> {
  const address = await accounts.createCustomerAddress(accountId, addressInput(value), db);
  const addresses = await accounts.listCustomerAddresses(accountId, db);
  return { address, addresses };
}

export async function updateCustomerAccountAddress(
  accountId: string,
  addressId: string,
  value: unknown,
  db: Db = pool(),
): Promise<{ address: CustomerAddress; addresses: CustomerAddress[] }> {
  const address = await accounts.updateCustomerAddress(accountId, addressId, addressInput(value), db);
  const addresses = await accounts.listCustomerAddresses(accountId, db);
  return { address, addresses };
}

export async function deleteCustomerAccountAddress(
  accountId: string,
  addressId: string,
  db: Db = pool(),
): Promise<CustomerAddress[]> {
  await accounts.deleteCustomerAddress(accountId, addressId, db);
  return accounts.listCustomerAddresses(accountId, db);
}

export async function requestCustomerPasswordReset(value: unknown, db: Db = pool()): Promise<{ message: string; resetToken?: string; expiresInSeconds: number }> {
  const generic = { message: "Se este e-mail estiver cadastrado, enviamos as instruções de redefinição.", expiresInSeconds: passwordResetSeconds };
  const raw = value as { email?: unknown } | null | undefined;
  const email = raw && typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!emailRe.test(email)) return generic;
  const local = localAuthEnabled();
  if (!local) passwordMailEndpoint();
  const record = await accounts.findCustomerByEmail(email, db);
  if (!record) return generic;
  const token = accounts.newOpaqueToken();
  await accounts.createPasswordReset(record.id, sha256(token), new Date(Date.now() + passwordResetSeconds * 1000), db);
  if (!local) await deliverPasswordReset(email, token);
  return local ? { ...generic, resetToken: token } : generic;
}

export async function resetCustomerPassword(value: unknown, db: Db = pool()): Promise<void> {
  const input = resetInput(value);
  const accountId = await accounts.consumePasswordReset(sha256(input.token), db);
  if (!accountId) throw new AdminError(400, "INVALID_TOKEN", "Link de redefinição inválido ou expirado.");
  await accounts.updateCustomerPassword(accountId, await hashPassword(input.password), db);
  await accounts.deleteCustomerSessionsForAccount(accountId, db); // revoke all sessions
}
