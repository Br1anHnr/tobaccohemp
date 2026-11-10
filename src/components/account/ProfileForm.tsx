"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { profileFromForm, validateProfile } from "@/lib/auth";
import { BRAZIL_STATES } from "@/lib/constants";
import { useAccount } from "@/store/account-store";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormErrorSummary } from "@/components/ui/FormErrorSummary";

export function ProfileForm() {
  const profile = useAccount((s) => s.profile);
  const updateProfile = useAccount((s) => s.updateProfile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  return (
    <>
      <section className="account-section" aria-labelledby="profile-form-title">
        <h2 id="profile-form-title">Dados cadastrais</h2>
        <form
          noValidate
          className="profile-form"
          onChange={() => setSaved(false)}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const invalid = validateProfile(data);
            setErrors(invalid);
            if (Object.keys(invalid).length) {
              setSaved(false);
              requestAnimationFrame(() => summary.current?.focus());
              return;
            }
            // Demo: kept only in memory. Replace with the customer API call.
            updateProfile(profileFromForm(data));
            setSaved(true);
          }}
        >
          <FormErrorSummary errors={errors} prefix="profile" ref={summary} />
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
            <Button type="submit">Salvar alterações</Button>
            <p className="form-feedback" role="status">
              {saved && (
                <>
                  <Check size={15} aria-hidden="true" /> Dados atualizados nesta
                  sessão demonstrativa.
                </>
              )}
            </p>
          </div>
        </form>
      </section>
      <section className="account-section" aria-labelledby="security-title">
        <h2 id="security-title">Segurança</h2>
        <p className="muted">
          A troca de senha será feita pelo serviço de autenticação quando ele
          estiver ativo. Nenhuma senha é exibida ou guardada nesta área.
        </p>
        <Link href="/conta/recuperar-senha" className="text-link">
          Redefinir senha
        </Link>
      </section>
    </>
  );
}
