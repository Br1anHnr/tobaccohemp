"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle } from "lucide-react";
import { profileFromForm, validateProfile } from "@/lib/auth";
import { BRAZIL_STATES } from "@/lib/constants";
import { useAccount } from "@/store/account-store";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormErrorSummary } from "@/components/ui/FormErrorSummary";

export function ProfileForm() {
  const profile = useAccount((s) => s.profile);
  const customer = useAccount((s) => s.customer);
  const saveProfile = useAccount((s) => s.saveProfile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const signedIn = Boolean(customer);

  return (
    <>
      <section className="account-section" aria-labelledby="profile-form-title">
        <h2 id="profile-form-title">Dados cadastrais</h2>
        <form
          noValidate
          className="profile-form"
          onChange={() => {
            setSaved(false);
            setFailure(null);
          }}
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const invalid = validateProfile(data);
            setErrors(invalid);
            setFailure(null);
            if (Object.keys(invalid).length) {
              setSaved(false);
              requestAnimationFrame(() => summary.current?.focus());
              return;
            }
            setPending(true);
            const result = await saveProfile(profileFromForm(data));
            setPending(false);
            if (result.ok) setSaved(true);
            else {
              setSaved(false);
              setFailure(result.message);
              requestAnimationFrame(() => summary.current?.focus());
            }
          }}
        >
          <FormErrorSummary errors={errors} prefix="profile" ref={summary} />
          {failure && (
            <p className="form-feedback is-error" role="alert">
              {failure}
            </p>
          )}
          <div className="form-grid">
            <FormField
              id="profile-name"
              name="name"
              label="Nome completo"
              autoComplete="name"
              defaultValue={profile.name}
              maxLength={120}
              wide
              error={errors.name}
            />
            <FormField
              id="profile-email"
              name="email"
              type="email"
              label="E-mail"
              autoComplete="email"
              defaultValue={profile.email}
              maxLength={160}
              readOnly={signedIn}
              hint={
                signedIn
                  ? "O e-mail é o seu acesso e só pode ser alterado pelo suporte."
                  : undefined
              }
              error={errors.email}
            />
            <FormField
              id="profile-phone"
              name="phone"
              type="tel"
              label="Telefone"
              autoComplete="tel"
              defaultValue={profile.phone}
              maxLength={20}
              error={errors.phone}
            />
            <FormField
              id="profile-city"
              name="city"
              label="Cidade"
              autoComplete="address-level2"
              defaultValue={profile.city}
              maxLength={80}
              error={errors.city}
            />
            <div className="form-field">
              <label htmlFor="profile-state">Estado</label>
              <select
                id="profile-state"
                name="state"
                defaultValue={profile.state}
                aria-invalid={Boolean(errors.state)}
              >
                <option value="">Selecione</option>
                {BRAZIL_STATES.map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
              </select>
              {errors.state && <small className="field-error">{errors.state}</small>}
            </div>
          </div>
          <div className="profile-actions">
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle size={15} className="spin" aria-hidden="true" />}
              {pending ? "Salvando…" : "Salvar alterações"}
            </Button>
            <p className="form-feedback" role="status">
              {saved && (
                <>
                  <Check size={15} aria-hidden="true" />
                  {signedIn
                    ? "Dados atualizados na sua conta."
                    : "Dados atualizados nesta sessão demonstrativa."}
                </>
              )}
            </p>
          </div>
        </form>
      </section>
      <section className="account-section" aria-labelledby="security-title">
        <h2 id="security-title">Segurança</h2>
        <p className="muted">
          A troca de senha é feita pelo fluxo de recuperação. Nenhuma senha é
          exibida ou guardada nesta área.
        </p>
        <Link href="/conta/recuperar-senha" className="text-link">
          Redefinir senha
        </Link>
      </section>
    </>
  );
}
