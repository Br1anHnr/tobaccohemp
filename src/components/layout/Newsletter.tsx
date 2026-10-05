"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
export function Newsletter() {
  const [done, setDone] = useState(false);
  return (
    <div className="newsletter">
      <h3>Receba novidades</h3>
      <p>Um novo detalhe para a sua rotina.</p>
      {done ? (
        <p role="status">Você testou o cadastro. Nenhum e-mail foi enviado.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDone(true);
          }}
        >
          <label className="sr-only" htmlFor="newsletter-email">
            Seu e-mail
          </label>
          <input
            id="newsletter-email"
            type="email"
            placeholder="Seu e-mail"
            autoComplete="email"
            required
          />
          <button aria-label="Cadastrar e-mail">
            <ArrowRight size={20} />
          </button>
        </form>
      )}
      <small>Cadastro demonstrativo nesta versão.</small>
    </div>
  );
}
