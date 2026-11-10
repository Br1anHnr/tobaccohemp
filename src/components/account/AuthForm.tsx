"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, LoaderCircle } from "lucide-react";
import {
  authClient,
  validateEmail,
  validateSignIn,
  validateSignUp,
} from "@/lib/auth";
import { useAccount } from "@/store/account-store";
import type { AuthResult } from "@/types/account";
import { Button } from "@/components/ui/Button";
import {
  CheckboxField,
  FormField,
  PasswordField,
} from "@/components/ui/FormField";
import { FormErrorSummary } from "@/components/ui/FormErrorSummary";

type Mode = "signin" | "signup" | "reset";
const submitLabel: Record<Mode, string> = {
  signin: "Entrar",
  signup: "Criar conta",
  reset: "Enviar instruções",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const startDemo = useAccount((s) => s.startDemo);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const id = (name: string) => `${mode}-${name}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const invalid =
      mode === "signin"
        ? validateSignIn(data)
        : mode === "signup"
          ? validateSignUp(data)
          : validateEmail(data);
    setErrors(invalid);
    setResult(null);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setPending(true);
    const email = String(data.get("email")).trim();
    const password = String(data.get("password") ?? "");
    const response =
      mode === "signin"
        ? await authClient.signIn({ email, password })
        : mode === "signup"
          ? await authClient.signUp({
              email,
              password,
              name: String(data.get("name")).trim(),
            })
          : await authClient.requestPasswordReset(email);
    // Passwords are discarded right after the request; nothing is persisted.
    form
      .querySelectorAll<HTMLInputElement>('input[name="password"], input[name="confirm"]')
      .forEach((input) => (input.value = ""));
    setPending(false);
    setResult(response);
    requestAnimationFrame(() => notice.current?.focus());
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit} aria-busy={pending}>
      <FormErrorSummary errors={errors} prefix={mode} ref={summary} />
      {result && (
        <div
          className={`auth-notice ${result.ok ? "is-success" : ""}`}
          role="alert"
          tabIndex={-1}
          ref={notice}
        >
          <Info size={17} aria-hidden="true" />
          <div>
            <p>
              {result.ok
                ? "Tudo certo! Siga as próximas instruções."
                : result.message}
            </p>
            {!result.ok && result.code === "not_configured" && mode !== "reset" && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  startDemo();
                  router.push("/conta");
                }}
              >
                Explorar a área do cliente demonstrativa
              </button>
            )}
          </div>
        </div>
      )}
      <div className="form-grid auth-grid">
        {mode === "signup" && (
          <FormField
            id={id("name")}
            name="name"
            label="Nome completo"
            autoComplete="name"
            maxLength={120}
            required
            wide
            error={errors.name}
          />
        )}
        <FormField
          id={id("email")}
          name="email"
          type="email"
          label="E-mail"
          autoComplete="email"
          inputMode="email"
          maxLength={160}
          required
          wide
          error={errors.email}
          hint={
            mode === "reset"
              ? "Enviaremos um link de redefinição quando o serviço estiver ativo."
              : undefined
          }
        />
        {mode !== "reset" && (
          <PasswordField
            id={id("password")}
            name="password"
            label="Senha"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            maxLength={128}
            required
            wide
            error={errors.password}
            hint={
              mode === "signup"
                ? "Mínimo de 8 caracteres, com letras e números."
                : undefined
            }
          />
        )}
        {mode === "signup" && (
          <>
            <PasswordField
              id={id("confirm")}
              name="confirm"
              label="Confirmar senha"
              autoComplete="new-password"
              maxLength={128}
              required
              wide
              error={errors.confirm}
            />
            <CheckboxField id={id("adult")} name="adult" error={errors.adult}>
              Declaro que tenho 18 anos ou mais.
            </CheckboxField>
            <CheckboxField id={id("terms")} name="terms" error={errors.terms}>
              Li e aceito os <Link href="/ajuda/termos">termos de uso</Link> e a{" "}
              <Link href="/ajuda/privacidade">política de privacidade</Link>.
            </CheckboxField>
          </>
        )}
      </div>
      {mode === "signin" && (
        <Link href="/conta/recuperar-senha" className="auth-forgot">
          Esqueceu sua senha?
        </Link>
      )}
      <Button type="submit" className="auth-submit" disabled={pending}>
        {pending && <LoaderCircle size={17} className="spin" aria-hidden="true" />}
        {pending ? "Enviando…" : submitLabel[mode]}
      </Button>
      <p className="auth-switch">
        {mode === "signin" && (
          <>
            Ainda não tem conta? <Link href="/conta/cadastro">Criar conta</Link>
          </>
        )}
        {mode === "signup" && (
          <>
            Já tem conta? <Link href="/conta/entrar">Entrar</Link>
          </>
        )}
        {mode === "reset" && (
          <>
            Lembrou a senha? <Link href="/conta/entrar">Voltar para o login</Link>
          </>
        )}
      </p>
    </form>
  );
}
