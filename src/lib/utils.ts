export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const itemKey = (id: string, variant?: string) =>
  `${id}:${variant ?? ""}`;
