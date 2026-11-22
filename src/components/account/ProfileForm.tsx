"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, MapPin, Plus, Trash2 } from "lucide-react";
import {
  addressFromForm,
  formatZip,
  profileFromForm,
  validateAddressForm,
  validateProfile,
} from "@/lib/auth";
import { BRAZIL_STATES } from "@/lib/constants";
import { useAccount } from "@/store/account-store";
import type { CustomerAddress } from "@/types/account";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { FormErrorSummary } from "@/components/ui/FormErrorSummary";

export function ProfileForm() {
  const profile = useAccount((s) => s.profile);
  const customer = useAccount((s) => s.customer);
  const saveProfile = useAccount((s) => s.saveProfile);
  const saveAddress = useAccount((s) => s.saveAddress);
  const updateAddress = useAccount((s) => s.updateAddress);
  const deleteAddress = useAccount((s) => s.deleteAddress);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const summary = useRef<HTMLDivElement>(null);

  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [addressPending, setAddressPending] = useState(false);
  const [addressFeedback, setAddressFeedback] = useState<string | null>(null);
  const [addressFailure, setAddressFailure] = useState<string | null>(null);
  const addressSummary = useRef<HTMLDivElement>(null);

  const signedIn = Boolean(customer);
  const addresses = customer?.addresses ?? [];

  function openNewAddressForm() {
    setEditingAddress(null);
    setAddressErrors({});
    setAddressFailure(null);
    setAddressFeedback(null);
    setAddressFormOpen(true);
  }

  function openEditAddressForm(address: CustomerAddress) {
    setEditingAddress(address);
    setAddressErrors({});
    setAddressFailure(null);
    setAddressFeedback(null);
    setAddressFormOpen(true);
  }

  return (
    <>
      <section className="account-section" aria-labelledby="profile-form-title">
        <h2 id="profile-form-title">Dados cadastrais</h2>
        <form
          key={profile.email}
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

      {signedIn && (
        <section className="account-section" aria-labelledby="addresses-title">
          <div className="account-section-head">
            <h2 id="addresses-title">Endereços de entrega</h2>
            {!addressFormOpen && (
              <Button type="button" variant="secondary" onClick={openNewAddressForm}>
                <Plus size={15} aria-hidden="true" /> Adicionar endereço
              </Button>
            )}
          </div>
          <p className="muted">
            Endereços salvos são reaproveitados automaticamente no seu próximo checkout.
          </p>

          {addressFeedback && (
            <p className="form-feedback" role="status">
              <Check size={15} aria-hidden="true" /> {addressFeedback}
            </p>
          )}
          {addressFailure && (
            <p className="form-feedback is-error" role="alert">
              {addressFailure}
            </p>
          )}

          {addresses.length > 0 ? (
            <ul className="address-list">
              {addresses.map((address) => (
                <li key={address.id} className="address-card">
                  <div className="address-card-body">
                    <div className="address-card-head">
                      <strong>
                        <MapPin size={14} aria-hidden="true" /> {address.label}
                      </strong>
                      {address.isDefault && (
                        <span className="address-badge">Principal</span>
                      )}
                    </div>
                    <p>
                      {address.street}, {address.number}
                      {address.complement ? ` — ${address.complement}` : ""}
                    </p>
                    <p className="muted">
                      {address.city} / {address.state} · CEP {formatZip(address.zip)}
                    </p>
                  </div>
                  <div className="address-card-actions">
                    {!address.isDefault && (
                      <button
                        type="button"
                        className="text-link"
                        disabled={addressPending}
                        onClick={async () => {
                          setAddressPending(true);
                          setAddressFailure(null);
                          setAddressFeedback(null);
                          const res = await updateAddress(address.id, {
                            label: address.label,
                            zip: address.zip,
                            street: address.street,
                            number: address.number,
                            complement: address.complement,
                            city: address.city,
                            state: address.state,
                            isDefault: true,
                          });
                          setAddressPending(false);
                          if (res.ok) setAddressFeedback("Endereço principal atualizado.");
                          else setAddressFailure(res.message);
                        }}
                      >
                        Tornar principal
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-link"
                      disabled={addressPending}
                      onClick={() => openEditAddressForm(address)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-link address-remove"
                      disabled={addressPending}
                      aria-label={`Remover endereço ${address.label}`}
                      onClick={async () => {
                        setAddressPending(true);
                        setAddressFailure(null);
                        setAddressFeedback(null);
                        const res = await deleteAddress(address.id);
                        setAddressPending(false);
                        if (res.ok) setAddressFeedback("Endereço removido.");
                        else setAddressFailure(res.message);
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            !addressFormOpen && (
              <p className="muted">Nenhum endereço salvo ainda.</p>
            )
          )}

          {addressFormOpen && (
            <form
              key={editingAddress?.id ?? "new-address"}
              noValidate
              className="address-form-panel"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const invalid = validateAddressForm(data);
                setAddressErrors(invalid);
                setAddressFailure(null);
                if (Object.keys(invalid).length) {
                  requestAnimationFrame(() => addressSummary.current?.focus());
                  return;
                }
                setAddressPending(true);
                const payload = addressFromForm(data);
                const result = editingAddress
                  ? await updateAddress(editingAddress.id, payload)
                  : await saveAddress(payload);
                setAddressPending(false);
                if (result.ok) {
                  setAddressFormOpen(false);
                  setEditingAddress(null);
                  setAddressFeedback(
                    editingAddress
                      ? "Endereço atualizado na sua conta."
                      : "Endereço salvo na sua conta.",
                  );
                } else {
                  setAddressFailure(result.message);
                }
              }}
            >
              <h3>{editingAddress ? "Editar endereço" : "Novo endereço"}</h3>
              <FormErrorSummary errors={addressErrors} prefix="addr" ref={addressSummary} />
              <div className="form-grid">
                <FormField
                  id="addr-label"
                  name="label"
                  label="Identificação (opcional)"
                  placeholder="Ex.: Casa, Trabalho"
                  defaultValue={editingAddress?.label ?? ""}
                  maxLength={40}
                />
                <FormField
                  id="addr-zip"
                  name="zip"
                  label="CEP"
                  autoComplete="postal-code"
                  defaultValue={editingAddress?.zip ?? ""}
                  maxLength={9}
                  required
                  error={addressErrors.zip}
                />
                <FormField
                  id="addr-street"
                  name="street"
                  label="Endereço"
                  autoComplete="address-line1"
                  defaultValue={editingAddress?.street ?? ""}
                  maxLength={160}
                  required
                  wide
                  error={addressErrors.street}
                />
                <FormField
                  id="addr-number"
                  name="number"
                  label="Número"
                  defaultValue={editingAddress?.number ?? ""}
                  maxLength={24}
                  required
                  error={addressErrors.number}
                />
                <FormField
                  id="addr-complement"
                  name="complement"
                  label="Complemento (opcional)"
                  autoComplete="address-line2"
                  defaultValue={editingAddress?.complement ?? ""}
                  maxLength={120}
                />
                <FormField
                  id="addr-city"
                  name="city"
                  label="Cidade"
                  autoComplete="address-level2"
                  defaultValue={editingAddress?.city ?? profile.city}
                  maxLength={80}
                  required
                  error={addressErrors.city}
                />
                <div className="form-field">
                  <label htmlFor="addr-state">Estado</label>
                  <select
                    id="addr-state"
                    name="state"
                    defaultValue={editingAddress?.state ?? profile.state}
                    aria-invalid={Boolean(addressErrors.state)}
                    required
                  >
                    <option value="">Selecione</option>
                    {BRAZIL_STATES.map((uf) => (
                      <option key={uf}>{uf}</option>
                    ))}
                  </select>
                  {addressErrors.state && (
                    <small className="field-error">{addressErrors.state}</small>
                  )}
                </div>
              </div>
              <label className="checkbox-label address-default-checkbox">
                <input
                  type="checkbox"
                  name="isDefault"
                  defaultChecked={editingAddress ? editingAddress.isDefault : true}
                />{" "}
                Definir como endereço principal
              </label>
              <div className="profile-actions">
                <Button type="submit" disabled={addressPending}>
                  {addressPending && (
                    <LoaderCircle size={15} className="spin" aria-hidden="true" />
                  )}
                  {addressPending ? "Salvando…" : "Salvar endereço"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={addressPending}
                  onClick={() => {
                    setAddressFormOpen(false);
                    setEditingAddress(null);
                    setAddressErrors({});
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </section>
      )}

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
