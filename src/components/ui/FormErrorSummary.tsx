"use client";
import { forwardRef } from "react";

/** Focusable list of form errors with links to each invalid field. */
export const FormErrorSummary = forwardRef<
  HTMLDivElement,
  { errors: Record<string, string>; prefix: string }
>(function FormErrorSummary({ errors, prefix }, ref) {
  const entries = Object.entries(errors);
  if (!entries.length) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref}>
      <strong>Confira os campos abaixo.</strong>
      <ul>
        {entries.map(([key, text]) => (
          <li key={key}>
            <a href={`#${prefix}-${key}`}>{text}</a>
          </li>
        ))}
      </ul>
    </div>
  );
});
