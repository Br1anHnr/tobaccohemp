"use client";

import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";

export function LoadingState({ label = "dados" }: { label?: string }) {
  return (
    <div className="table-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>Carregando {label}…</p>
    </div>
  );
}

export function EmptyState({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  return (
    <div className="table-state">
      <Inbox size={32} strokeWidth={1} aria-hidden="true" />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
    </div>
  );
}

export function ErrorState({
  onRetry,
  text = "Ocorreu um erro ao buscar os dados. Tente novamente.",
}: {
  onRetry: () => void;
  text?: string;
}) {
  return (
    <div className="table-state" role="alert">
      <AlertTriangle size={32} strokeWidth={1} aria-hidden="true" />
      <h3>Não foi possível carregar.</h3>
      <p>{text}</p>
      <button type="button" className="button button-secondary" onClick={onRetry}>
        <RefreshCw size={15} aria-hidden="true" />
        Tentar novamente
      </button>
    </div>
  );
}
