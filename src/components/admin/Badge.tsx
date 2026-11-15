import type { OrderStatus } from "@/shared/contracts/orders";

export type StatusValue =
  | "ativo"
  | "novo"
  | "inativo"
  | "em_estoque"
  | "baixo"
  | "esgotado"
  | OrderStatus;

const STATUS_LABEL: Record<StatusValue, string> = {
  ativo: "Ativo",
  novo: "Novo",
  inativo: "Inativo",
  em_estoque: "Em estoque",
  baixo: "Estoque baixo",
  esgotado: "Esgotado",
  draft: "Rascunho",
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  expired: "Expirado",
  canceled: "Cancelado",
  refunded: "Estornado",
};

export function StatusBadge({ status }: { status: StatusValue }) {
  return (
    <span className={`badge-status badge-status--${status}`}>
      <span className="dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
