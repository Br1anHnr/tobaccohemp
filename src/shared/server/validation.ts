export class AdminError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function invalid(): never {
  throw new AdminError(422, "VALIDATION", "Dados inválidos.");
}

export function objectInput(value: unknown, keys: string[], partial = false): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const object = value as Record<string, unknown>;
  if (!Object.keys(object).length || Object.keys(object).some(key => !keys.includes(key))) invalid();
  if (!partial && keys.some(key => !(key in object))) invalid();
  return object;
}

export function textInput(value: unknown, max: number): string {
  if (typeof value !== "string") invalid();
  const text = value.trim();
  if (!text.length || text.length > max || /[\u0000-\u001f\u007f]/u.test(text)) invalid();
  return text;
}

/** Like `textInput`, but permits an empty string (e.g. optional descriptions). */
export function textInputAllowEmpty(value: unknown, max: number): string {
  if (typeof value !== "string") invalid();
  const text = value.trim();
  if (text.length > max || /[\u0000-\u001f\u007f]/u.test(text)) invalid();
  return text;
}

export function integerInput(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) invalid();
  return value;
}

export function missing(): never {
  throw new AdminError(404, "NOT_FOUND", "Registro não encontrado.");
}

export function duplicate(): never {
  throw new AdminError(409, "DUPLICATE", "Registro já cadastrado.");
}
