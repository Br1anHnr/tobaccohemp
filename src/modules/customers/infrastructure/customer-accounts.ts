import { randomBytes, randomUUID } from "node:crypto";
import type {
  CustomerAddress,
  CustomerAddressInput,
  CustomerProfileInput,
} from "@/shared/contracts/customer";
import { pool, type Db } from "@/shared/server/database";
import { AdminError, missing } from "@/shared/server/validation";

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
  city: string;
  state: string;
  createdAt: string;
}

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone: string;
  city: string;
  state: string;
  created_at: Date | string;
}

interface CustomerAddressRow {
  id: string;
  label: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  city: string;
  state: string;
  is_default: boolean;
  updated_at: Date | string;
}

const MAX_ADDRESSES_PER_ACCOUNT = 10;

/** Opaque session/reset token; only its SHA-256 digest is ever persisted. */
export const newOpaqueToken = () => randomBytes(32).toString("hex");

function toRecord(row: CustomerRow): CustomerRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    phone: String(row.phone ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function toAddress(row: CustomerAddressRow): CustomerAddress {
  return {
    id: String(row.id),
    label: String(row.label ?? "Principal"),
    zip: String(row.zip),
    street: String(row.street),
    number: String(row.number),
    complement: String(row.complement ?? ""),
    city: String(row.city),
    state: String(row.state),
    isDefault: Boolean(row.is_default),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export async function createCustomerAccount(
  input: { name: string; email: string; phone: string; passwordHash: string },
  db: Db = pool(),
): Promise<CustomerRecord> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO customer_accounts (id, name, email, password_hash, phone, city, state, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '', '', $6, $6)`,
    [id, input.name, input.email, input.passwordHash, input.phone, now],
  );
  return {
    id,
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    phone: input.phone,
    city: "",
    state: "",
    createdAt: now,
  };
}

export async function findCustomerByEmail(email: string, db: Db = pool()): Promise<CustomerRecord | null> {
  const result = await db.query(
    `SELECT id, name, email, password_hash, phone, city, state, created_at
     FROM customer_accounts WHERE lower(email) = lower($1)`,
    [email],
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export async function findCustomerById(id: string, db: Db = pool()): Promise<CustomerRecord | null> {
  const result = await db.query(
    `SELECT id, name, email, password_hash, phone, city, state, created_at
     FROM customer_accounts WHERE id = $1`,
    [id],
  );
  return result.rows[0] ? toRecord(result.rows[0]) : null;
}

export async function updateCustomerProfile(id: string, input: CustomerProfileInput, db: Db = pool()): Promise<CustomerRecord> {
  const result = await db.query(
    `UPDATE customer_accounts SET name = $2, phone = $3, city = $4, state = $5, updated_at = $6
     WHERE id = $1
     RETURNING id, name, email, password_hash, phone, city, state, created_at`,
    [id, input.name, input.phone, input.city, input.state, new Date().toISOString()],
  );
  if (!result.rows[0]) missing();
  return toRecord(result.rows[0]);
}

export async function listCustomerAddresses(accountId: string, db: Db = pool()): Promise<CustomerAddress[]> {
  const result = await db.query(
    `SELECT id, label, zip, street, number, complement, city, state, is_default, updated_at
     FROM customer_addresses
     WHERE account_id = $1
     ORDER BY is_default DESC, updated_at DESC, created_at DESC`,
    [accountId],
  );
  return (result.rows as CustomerAddressRow[]).map(toAddress);
}

export async function lockCustomerAddressBook(accountId: string, db: Db) {
  const result = await db.query("SELECT id FROM customer_accounts WHERE id = $1 FOR UPDATE", [accountId]);
  if (!result.rowCount) missing();
}

export async function createCustomerAddress(
  accountId: string,
  input: CustomerAddressInput,
  db: Db = pool(),
): Promise<CustomerAddress> {
  const now = new Date().toISOString();
  const label = input.label || "Principal";
  const complement = input.complement ?? "";

  const existing = await listCustomerAddresses(accountId, db);
  const matching = existing.find(
    (addr) =>
      addr.zip === input.zip &&
      addr.street.toLowerCase() === input.street.toLowerCase() &&
      addr.number.toLowerCase() === input.number.toLowerCase() &&
      addr.complement.toLowerCase() === complement.toLowerCase() &&
      addr.city.toLowerCase() === input.city.toLowerCase() &&
      addr.state === input.state,
  );

  const shouldBeDefault = input.isDefault ?? true;

  if (matching) {
    if (shouldBeDefault) {
      await db.query(
        "UPDATE customer_addresses SET is_default = false WHERE account_id = $1 AND id <> $2 AND is_default = true",
        [accountId, matching.id],
      );
    }
    const updated = await db.query(
      `UPDATE customer_addresses
       SET label = $3, is_default = $4, updated_at = $5
       WHERE id = $1 AND account_id = $2
       RETURNING id, label, zip, street, number, complement, city, state, is_default, updated_at`,
      [matching.id, accountId, label, shouldBeDefault || matching.isDefault, now],
    );
    await db.query(
      `UPDATE customer_accounts
       SET city = CASE WHEN city = '' THEN $2 ELSE city END,
           state = CASE WHEN state = '' THEN $3 ELSE state END,
           updated_at = $4
       WHERE id = $1 AND (city = '' OR state = '')`,
      [accountId, input.city, input.state, now],
    );
    return toAddress(updated.rows[0] as CustomerAddressRow);
  }

  if (existing.length >= MAX_ADDRESSES_PER_ACCOUNT) {
    throw new AdminError(422, "ADDRESS_LIMIT", `Limite de ${MAX_ADDRESSES_PER_ACCOUNT} endereços por conta atingido.`);
  }

  const isDefault = existing.length === 0 ? true : shouldBeDefault;
  if (isDefault && existing.length > 0) {
    await db.query(
      "UPDATE customer_addresses SET is_default = false WHERE account_id = $1 AND is_default = true",
      [accountId],
    );
  }

  const id = randomUUID();
  const result = await db.query(
    `INSERT INTO customer_addresses
       (id, account_id, label, zip, street, number, complement, city, state, is_default, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
     RETURNING id, label, zip, street, number, complement, city, state, is_default, updated_at`,
    [id, accountId, label, input.zip, input.street, input.number, complement, input.city, input.state, isDefault, now],
  );

  await db.query(
    `UPDATE customer_accounts
     SET city = CASE WHEN city = '' THEN $2 ELSE city END,
         state = CASE WHEN state = '' THEN $3 ELSE state END,
         updated_at = $4
     WHERE id = $1 AND (city = '' OR state = '')`,
    [accountId, input.city, input.state, now],
  );

  return toAddress(result.rows[0] as CustomerAddressRow);
}

export async function updateCustomerAddress(
  accountId: string,
  addressId: string,
  input: CustomerAddressInput,
  db: Db = pool(),
): Promise<CustomerAddress> {
  const current = await db.query(
    "SELECT id, is_default FROM customer_addresses WHERE id = $1 AND account_id = $2",
    [addressId, accountId],
  );
  if (!current.rows[0]) missing();

  const isDefault = input.isDefault ?? Boolean(current.rows[0].is_default);
  if (isDefault) {
    await db.query(
      "UPDATE customer_addresses SET is_default = false WHERE account_id = $1 AND id <> $2 AND is_default = true",
      [accountId, addressId],
    );
  }

  const now = new Date().toISOString();
  const result = await db.query(
    `UPDATE customer_addresses
     SET label = $3, zip = $4, street = $5, number = $6, complement = $7,
         city = $8, state = $9, is_default = $10, updated_at = $11
     WHERE id = $1 AND account_id = $2
     RETURNING id, label, zip, street, number, complement, city, state, is_default, updated_at`,
    [
      addressId,
      accountId,
      input.label || "Principal",
      input.zip,
      input.street,
      input.number,
      input.complement ?? "",
      input.city,
      input.state,
      isDefault,
      now,
    ],
  );
  if (!result.rows[0]) missing();
  return toAddress(result.rows[0] as CustomerAddressRow);
}

export async function deleteCustomerAddress(accountId: string, addressId: string, db: Db = pool()): Promise<void> {
  const deleted = await db.query(
    "DELETE FROM customer_addresses WHERE id = $1 AND account_id = $2 RETURNING is_default",
    [addressId, accountId],
  );
  if (!deleted.rows[0]) missing();
  if (deleted.rows[0].is_default) {
    await db.query(
      `UPDATE customer_addresses
       SET is_default = true
       WHERE id = (
         SELECT id FROM customer_addresses
         WHERE account_id = $1
         ORDER BY updated_at DESC, created_at DESC
         LIMIT 1
       )`,
      [accountId],
    );
  }
}

export async function updateCustomerPassword(id: string, passwordHash: string, db: Db = pool()): Promise<void> {
  const result = await db.query(
    "UPDATE customer_accounts SET password_hash = $2, updated_at = $3 WHERE id = $1",
    [id, passwordHash, new Date().toISOString()],
  );
  if (result.rowCount === 0) missing();
}

export async function createCustomerSession(accountId: string, tokenHash: string, expiresAt: Date, db: Db = pool()): Promise<void> {
  await db.query(
    "INSERT INTO customer_sessions (token_hash, account_id, expires_at, created_at) VALUES ($1, $2, $3, $4)",
    [tokenHash, accountId, expiresAt.toISOString(), new Date().toISOString()],
  );
}

export async function findCustomerSession(
  tokenHash: string,
  db: Db = pool(),
): Promise<{ account: CustomerRecord; addresses: CustomerAddress[]; expiresAt: Date } | null> {
  const result = await db.query(
    `SELECT a.id, a.name, a.email, a.password_hash, a.phone, a.city, a.state, a.created_at, s.expires_at,
            COALESCE(
              (SELECT json_agg(
                 json_build_object(
                   'id', ca.id,
                   'label', ca.label,
                   'zip', ca.zip,
                   'street', ca.street,
                   'number', ca.number,
                   'complement', ca.complement,
                   'city', ca.city,
                   'state', ca.state,
                   'is_default', ca.is_default,
                   'updated_at', ca.updated_at
                 )
                 ORDER BY ca.is_default DESC, ca.updated_at DESC, ca.created_at DESC
               )
               FROM customer_addresses ca
               WHERE ca.account_id = a.id),
              '[]'::json
            ) AS addresses
     FROM customer_sessions s
     JOIN customer_accounts a ON a.id = s.account_id
     WHERE s.token_hash = $1`,
    [tokenHash],
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  const rawAddresses = Array.isArray(row.addresses) ? (row.addresses as CustomerAddressRow[]) : [];
  return {
    account: toRecord(row),
    addresses: rawAddresses.map(toAddress),
    expiresAt: new Date(row.expires_at),
  };
}

export async function deleteCustomerSession(tokenHash: string, db: Db = pool()): Promise<void> {
  await db.query("DELETE FROM customer_sessions WHERE token_hash = $1", [tokenHash]);
}

export async function deleteCustomerSessionsForAccount(accountId: string, db: Db = pool()): Promise<void> {
  await db.query("DELETE FROM customer_sessions WHERE account_id = $1", [accountId]);
}

export async function createPasswordReset(accountId: string, tokenHash: string, expiresAt: Date, db: Db = pool()): Promise<void> {
  await db.query(
    "INSERT INTO customer_password_resets (id, account_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)",
    [randomUUID(), accountId, tokenHash, expiresAt.toISOString(), new Date().toISOString()],
  );
}

/** Consumes a reset token atomically; returns the account id or null if invalid/expired/used. */
export async function consumePasswordReset(tokenHash: string, db: Db = pool()): Promise<string | null> {
  const result = await db.query(
    `UPDATE customer_password_resets SET used_at = $2
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING account_id`,
    [tokenHash, new Date().toISOString()],
  );
  return result.rows[0] ? String(result.rows[0].account_id) : null;
}
