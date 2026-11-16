import bcrypt from "bcryptjs";

/**
 * Administrative credential hashing (bcrypt).
 *
 * The storefront customer accounts keep their own scrypt-based hashing
 * (`modules/customers/infrastructure/password.ts`); the two domains are
 * intentionally independent so an upgrade here never invalidates customer
 * credentials and vice-versa.
 */
export const ADMIN_BCRYPT_ROUNDS = 12;

export function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ADMIN_BCRYPT_ROUNDS);
}

export function verifyAdminPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
