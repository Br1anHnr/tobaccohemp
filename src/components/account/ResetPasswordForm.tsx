"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Info, LoaderCircle } from "lucide-react";
import { authClient, validateResetPassword } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/FormField";
import { FormErrorSummary } from "@/components/ui/FormErrorSummary";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const summary = useRef<HTMLDivElement>(null);

  if (!token) {
    return (
      <div className="auth-notice" role="alert">
        <Info size={17} aria-hidden="true" />
        <div>
          <p>Link de redefinição inválido ou expirado.</p>
          <Link href="/conta/recuperar-senha" className="text-link">
            Solicitar um novo link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-notice is-success" role="status">
        <Check size={17} aria-hidden="true" />
        <div>
          <p>Senha redefinida com sucesso.</p>
          <Link href="/conta/entrar" className="text-link">
            Entrar com a nova senha
          </Link>
        </div>
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const invalid = validateResetPassword(data);
    setErrors(invalid);
    setFailure(null);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword(token, String(data.get("password") ?? ""));
    setPending(false);
    if (result.ok) setDone(true);
    else {
      setFailure(result.message);
      requestAnimationFrame(() => summary.current?.focus());
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit} aria-busy={pending}>
      <FormErrorSummary errors={errors} prefix="reset" ref={summary} />
      {failure && (
        <div className="auth-notice" role="alert" tabIndex={-1} ref={summary}>
          <Info size={17} aria-hidden="true" />
          <div>
            <p>{failure}</p>
          </div>
        </div>
      )}
      <div className="form-grid auth-grid">
        <PasswordField
          id="reset-password"
          name="password"
          label="Nova senha"
          autoComplete="new-password"
          maxLength={128}
          required
          wide
          error={errors.password}
          hint="Mínimo de 8 caracteres, com letras e números."
        />
        <PasswordField
          id="reset-confirm"
          name="confirm"
          label="Confirmar nova senha"
          autoComplete="new-password"
          maxLength={128}
          required
          wide
          error={errors.confirm}
        />
      </div>
      <Button type="submit" className="auth-submit" disabled={pending}>
        {pending && <LoaderCircle size={17} className="spin" aria-hidden="true" />}
        {pending ? "Salvando…" : "Redefinir senha"}
      </Button>
      <p className="auth-switch">
        Lembrou a senha? <Link href="/conta/entrar">Voltar para o login</Link>
      </p>
    </form>
  );
}
