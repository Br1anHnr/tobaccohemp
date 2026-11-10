export type StatusValue =
  | "ativo"
  | "novo"
  | "inativo"
  | "em_estoque"
  | "baixo"
  | "esgotado";

const STATUS_LABEL: Record<StatusValue, string> = {
  ativo: "Ativo",
  novo: "Novo",
  inativo: "Inativo",
  em_estoque: "Em estoque",
  baixo: "Estoque baixo",
  esgotado: "Esgotado",
};

export function StatusBadge({ status }: { status: StatusValue }) {
  return (
    <span className={`badge-status badge-status--${status}`}>
      <span className="dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
