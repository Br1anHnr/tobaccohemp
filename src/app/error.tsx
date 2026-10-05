"use client";
import { Button } from "@/components/ui/Button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>Vamos tentar de novo?</h1>
      <p>Não foi possível carregar esta página.</p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
