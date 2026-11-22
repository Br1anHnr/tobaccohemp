import type { OrderEligibilityStatus } from "@/shared/contracts/orders";
import { normalize } from "@/lib/utils";

/**
 * Policy gate for online orders. Real payment processing and live sales
 * remain disabled until commercial, contractual, and regulatory checks pass.
 */
export const ONLINE_COMMERCE_POLICY = {
  realPaymentsEnabled: false,
  mode: "demonstrative" as const,
  notice:
    "Modo demonstrativo ativo. Pagamentos reais e vendas online definitivas aguardam homologação.",
};

export const ALLOWED_ACCESSORY_CATEGORIES = new Set([
  "cases",
  "shoulder-bags",
  "bandejas",
  "organizadores",
  "cinzeiros",
  "kits",
]);

const BLOCKED_REGULATED_TERMS = [
  "tabaco",
  "nicotina",
  "cigarro",
  "eletronico",
  "vape",
  "pod",
  "e-cig",
  "cannabis",
  "thc",
  "cbd",
  "fumigeno",
  "seda",
  "dichavador",
  "piteira",
];

export interface EligibilitySubject {
  id: string;
  name: string;
  sku?: string;
  categorySlug?: string | null;
  active?: boolean;
  archived?: boolean;
  stock?: number;
  tags?: string[];
}

export interface ItemEligibilityResult {
  eligibleForDemo: boolean;
  eligibleForRealCharge: false;
  reason?: string;
}

export interface OrderEligibilitySummary {
  allowed: boolean;
  eligibilityStatus: OrderEligibilityStatus;
  blockedReasons: string[];
}

export function evaluateItemEligibility(
  product: EligibilitySubject | undefined,
  quantity: number,
): ItemEligibilityResult {
  if (!product) {
    return {
      eligibleForDemo: false,
      eligibleForRealCharge: false,
      reason: "Produto não localizado no catálogo autorizado.",
    };
  }
  if (product.archived === true) {
    return {
      eligibleForDemo: false,
      eligibleForRealCharge: false,
      reason: `O produto "${product.name}" está arquivado.`,
    };
  }
  if (product.active === false) {
    return {
      eligibleForDemo: false,
      eligibleForRealCharge: false,
      reason: `O produto "${product.name}" está inativo.`,
    };
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return {
      eligibleForDemo: false,
      eligibleForRealCharge: false,
      reason: `Quantidade inválida para "${product.name}".`,
    };
  }
  if (typeof product.stock === "number" && quantity > product.stock) {
    return {
      eligibleForDemo: false,
      eligibleForRealCharge: false,
      reason: `Quantidade solicitada de "${product.name}" excede o estoque disponível (${product.stock}).`,
    };
  }

  if (!product.categorySlug || !ALLOWED_ACCESSORY_CATEGORIES.has(product.categorySlug)) {
    return {
      eligibleForDemo: false,
      eligibleForRealCharge: false,
      reason: product.categorySlug
        ? `Categoria "${product.categorySlug}" não elegível para pedidos online.`
        : `O produto "${product.name}" não possui categoria elegível classificada.`,
    };
  }

  const haystack = normalize(
    [product.name, product.sku ?? "", product.categorySlug ?? "", ...(product.tags ?? [])].join(" "),
  );
  const blocked = BLOCKED_REGULATED_TERMS.find((term) => haystack.includes(term));
  if (blocked) {
    return {
      eligibleForDemo: false,
      eligibleForRealCharge: false,
      reason: `O item "${product.name}" não é elegível para venda online por restrição de catálogo.`,
    };
  }

  return {
    eligibleForDemo: true,
    eligibleForRealCharge: false,
  };
}

export function evaluateOrderEligibility(
  entries: Array<{ product: EligibilitySubject | undefined; quantity: number }>,
): OrderEligibilitySummary {
  if (entries.length === 0) {
    return {
      allowed: false,
      eligibilityStatus: "blocked",
      blockedReasons: ["O pedido precisa conter ao menos um item elegível."],
    };
  }

  const blockedReasons: string[] = [];
  const totalsByProduct = new Map<string, { product: EligibilitySubject; totalQuantity: number }>();

  for (const entry of entries) {
    const check = evaluateItemEligibility(entry.product, entry.quantity);
    if (!check.eligibleForDemo && check.reason) {
      blockedReasons.push(check.reason);
      continue;
    }
    if (entry.product) {
      const current = totalsByProduct.get(entry.product.id);
      totalsByProduct.set(entry.product.id, {
        product: entry.product,
        totalQuantity: (current?.totalQuantity ?? 0) + entry.quantity,
      });
    }
  }

  for (const { product, totalQuantity } of totalsByProduct.values()) {
    if (typeof product.stock === "number" && totalQuantity > product.stock) {
      blockedReasons.push(
        `Quantidade total solicitada de "${product.name}" (${totalQuantity}) excede o estoque disponível (${product.stock}).`,
      );
    }
  }

  return {
    allowed: blockedReasons.length === 0,
    eligibilityStatus: blockedReasons.length === 0 ? "eligible_demo" : "blocked",
    blockedReasons,
  };
}
