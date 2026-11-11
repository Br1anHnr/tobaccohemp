import { randomUUID } from "node:crypto";
import type { Customer } from "@/shared/contracts/admin";
import { pool, type Db } from "@/shared/server/database";
import { duplicate, missing } from "@/shared/server/validation";
import { customerInput } from "../domain/customer-input";

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function listCustomers(db: Db = pool()): Promise<Customer[]> {
  const result = await db.query("SELECT id, name, email, status, created_at FROM customers ORDER BY created_at, id");
  return result.rows.map(row => ({
    id: String(row.id), name: String(row.name), email: String(row.email),
    status: row.status === "active" ? "active" : "inactive", createdAt: toIso(row.created_at),
  }));
}

export async function saveCustomer(value: unknown, id?: string, db: Db = pool()): Promise<Customer> {
  const input = customerInput(value, id !== undefined);
  const rows = await listCustomers(db);
  const existing = id === undefined ? undefined : rows.find(item => item.id === id);
  if (id !== undefined && !existing) missing();
  const customer: Customer = {
    id: existing?.id ?? randomUUID(), name: input.name ?? existing?.name ?? "",
    email: input.email ?? existing?.email ?? "", status: input.status ?? existing?.status ?? "active",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  if (rows.some(item => item.id !== customer.id && item.email.toLowerCase() === customer.email)) duplicate();
  await db.query(
    `INSERT INTO customers (id, name, email, status, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, status = EXCLUDED.status`,
    [customer.id, customer.name, customer.email, customer.status, customer.createdAt],
  );
  return customer;
}
