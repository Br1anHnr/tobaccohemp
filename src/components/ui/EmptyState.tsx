import { ShoppingBag } from "lucide-react";
import { ButtonLink } from "./Button";
export function EmptyState({
  title = "Seu carrinho está esperando por você.",
  text = "Encontre os acessórios que combinam com sua rotina.",
  compact = false,
}: {
  title?: string;
  text?: string;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <ShoppingBag size={38} strokeWidth={1} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      <ButtonLink href="/loja">Explorar a loja</ButtonLink>
    </div>
  );
}
