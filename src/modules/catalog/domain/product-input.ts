import type { ProductInput } from "@/shared/contracts/admin";
import { integerInput, invalid, textInput, textInputAllowEmpty } from "@/shared/server/validation";

const ALLOWED = [
  "slug", "sku", "name", "description", "brand", "categorySlug",
  "priceCents", "active", "archived", "isNew", "isFeatured", "tags", "variants",
] as const;

const REQUIRED_ON_CREATE = ["sku", "name", "priceCents", "active"] as const;

function slugText(value: unknown): string {
  const slug = textInput(value, 160).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(slug)) invalid();
  return slug;
}

function optionalText(value: unknown, max: number): string {
  return textInput(value, max);
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) invalid();
  return value.map(item => {
    const text = textInput(item, maxLength);
    return text;
  });
}

export function productInput(value: unknown, partial = false): Partial<ProductInput> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object);
  if (!keys.length || keys.some(key => !(ALLOWED as readonly string[]).includes(key))) invalid();
  if (!partial) {
    for (const required of REQUIRED_ON_CREATE) {
      if (!(required in object)) invalid();
    }
  }

  const result: Partial<ProductInput> = {};
  if ("slug" in object) result.slug = slugText(object.slug);
  if ("sku" in object) {
    result.sku = textInput(object.sku, 64).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]*$/u.test(result.sku)) invalid();
  }
  if ("name" in object) result.name = textInput(object.name, 120);
  if ("description" in object) result.description = textInputAllowEmpty(object.description, 2000);
  if ("brand" in object) result.brand = optionalText(object.brand, 120);
  if ("categorySlug" in object) {
    if (object.categorySlug === null) result.categorySlug = null;
    else result.categorySlug = textInput(object.categorySlug, 80).toLowerCase();
  }
  if ("priceCents" in object) result.priceCents = integerInput(object.priceCents);
  for (const flag of ["active", "archived", "isNew", "isFeatured"] as const) {
    if (flag in object) {
      if (typeof object[flag] !== "boolean") invalid();
      result[flag] = object[flag];
    }
  }
  if ("tags" in object) result.tags = stringArray(object.tags, 20, 32);
  if ("variants" in object) result.variants = stringArray(object.variants, 12, 32);
  return result;
}
