"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/lib/admin-service";
import { Logo } from "@/components/layout/Logo";

const subscribeHydration = () => () => {};
const isClientHydrated = () => true;
const isServerHydrated = () => false;

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const hydrated = useSyncExternalStore(subscribeHydration, isClientHydrated, isServerHydrated);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError("");
    try {
      await loginAdmin({ email, password });
      setPassword("");
      const next = new URLSearchParams(window.location.search).get("next") ?? "/admin";
      router.replace(/^\/admin(?:\/(?:clientes|produtos))?$/.test(next) ? next : "/admin");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally { setPending(false); }
  }
  return (
    <section className="table-card admin-login-card" aria-labelledby="admin-login-title">
      <Logo />
      <h1 id="admin-login-title">Acesso administrativo</h1>
      <p>Ambiente local com dados sintéticos.</p>
      <form method="post" onSubmit={submit}>
        <label htmlFor="admin-email">E-mail</label>
        <input id="admin-email" name="email" type="email" autoComplete="username" required value={email}
          onChange={event => setEmail(event.target.value)} />
        <label htmlFor="admin-password">Senha</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required value={password}
          onChange={event => setPassword(event.target.value)} />
        {error && <p role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={pending || !hydrated}>{pending ? "Entrando…" : "Entrar"}</button>
      </form>
    </section>
  );
}
