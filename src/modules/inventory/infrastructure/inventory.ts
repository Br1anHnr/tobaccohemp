import type { InventoryItem } from "@/shared/contracts/admin";
import { listProducts } from "@/modules/catalog";
import { pool, type Db } from "@/shared/server/database";
import { integerInput, missing, objectInput } from "@/shared/server/validation";

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function listInventory(db: Db = pool()): Promise<InventoryItem[]> {
  const products = await listProducts(db);
  // Ensure an inventory row exists for every product (new rows start at zero).
  for (const product of products) {
    await db.query(
      `INSERT INTO inventory (product_id, quantity, reorder_point, updated_at)
       VALUES ($1, 0, 0, $2) ON CONFLICT (product_id) DO NOTHING`,
      [product.id, product.createdAt],
    );
  }
  const result = await db.query("SELECT product_id, quantity, reorder_point, updated_at FROM inventory ORDER BY product_id");
  return result.rows.map(row => ({
    productId: String(row.product_id), quantity: Number(row.quantity),
    reorderPoint: Number(row.reorder_point), updatedAt: toIso(row.updated_at),
  }));
}

export async function saveInventory(value: unknown, productId: string, db: Db = pool()): Promise<InventoryItem> {
  const input = objectInput(value, ["quantity", "reorderPoint"]);
  const quantity = integerInput(input.quantity);
  const reorderPoint = integerInput(input.reorderPoint);
  if (!(await listInventory(db)).some(item => item.productId === productId)) missing();
  const item = { productId, quantity, reorderPoint, updatedAt: new Date().toISOString() };
  await db.query(
    "UPDATE inventory SET quantity = $1, reorder_point = $2, updated_at = $3 WHERE product_id = $4",
    [quantity, reorderPoint, item.updatedAt, productId],
  );
  return item;
}
