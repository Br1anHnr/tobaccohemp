"use client";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  wide?: boolean;
  adornment?: ReactNode;
};

/** Labelled input with hint and error wiring for screen readers. */
export function FormField({
  id,
  label,
  error,
  hint,
  wide = false,
  adornment,
  className = "",
  ...input
}: InputProps) {
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={`form-field ${wide ? "field-wide" : ""} ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className={adornment ? "field-control has-adornment" : "field-control"}>
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...input}
        />
        {adornment}
      </div>
      {hint && (
        <small className="field-hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
      {error && (
        <small className="field-error" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}

export function PasswordField(props: Omit<InputProps, "type" | "adornment">) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField
      {...props}
      type={visible ? "text" : "password"}
      adornment={
        <button
          type="button"
          className="field-adornment"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          aria-controls={props.id}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      }
    />
  );
}

export function CheckboxField({
  name,
  id,
  children,
  error,
}: {
  name: string;
  id: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="form-field field-wide">
      <label className="checkbox-label" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          name={name}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      {error && (
        <small className="field-error" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}
