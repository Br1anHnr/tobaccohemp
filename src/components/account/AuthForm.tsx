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
import { Button, ButtonLink } from "@/components/ui/Button";
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
  const customer = useAccount((s) => s.customer);
  const signIn = useAccount((s) => s.signIn);
  const signUp = useAccount((s) => s.signUp);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const id = (name: string) => `${mode}-${name}`;

  if (customer && (mode === "signin" || mode === "signup")) {
    return (
      <div className="auth-already-signed-in">
        <div className="auth-notice is-success" role="status">
          <Info size={17} aria-hidden="true" />
          <div>
            <p>
              Você já está conectado como <strong>{customer.name}</strong> (
              {customer.email}).
            </p>
          </div>
        </div>
        <div className="account-links">
          <ButtonLink href="/conta">Ir para minha conta</ButtonLink>
          <ButtonLink href="/carrinho" variant="secondary">
            Ver meu carrinho
          </ButtonLink>
          <ButtonLink href="/loja" variant="ghost">
            Continuar explorando
          </ButtonLink>
        </div>
      </div>
    );
  }

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
    const response: AuthResult =
      mode === "signin"
        ? await signIn({ email, password })
        : mode === "signup"
          ? await signUp({
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
    if (response.ok) {
      if (mode === "reset") {
        if (response.resetToken) {
          router.push(`/conta/redefinir-senha?token=${encodeURIComponent(response.resetToken)}`);
          return;
        }
        setResult(response);
        requestAnimationFrame(() => notice.current?.focus());
        return;
      }
      router.push("/conta");
      return;
    }
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
            <p>{result.ok ? (result.message ?? "Tudo certo!") : result.message}</p>
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
              ? "Enviaremos as instruções de redefinição para este e-mail."
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
