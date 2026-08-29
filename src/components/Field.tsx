import type { ComponentProps, ReactNode } from "react";

/**
 * Form primitives. Every input gets a real <label> above it (not a
 * placeholder standing in for one) and a visible error message tied to the
 * field with aria-describedby.
 */

const controlBase =
  "w-full rounded-slab border-2 bg-white px-3 py-2.5 text-base text-slab-900 " +
  "placeholder:text-slab-400 transition-colors duration-150 ease-out " +
  "focus:border-slab-900 focus:outline-none";

const controlState = (hasError: boolean) =>
  hasError ? "border-alert bg-alert-tint/40" : "border-slab-300";

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-bold uppercase tracking-wide text-slab-700"
      >
        {label}
        {required ? (
          <span className="text-alert" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-slab-500">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-sm font-semibold text-alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(
    Boolean,
  );
  return ids.length ? ids.join(" ") : undefined;
}

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  id,
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: FieldProps & ComponentProps<"input">) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <input
        id={id}
        name={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${controlBase} ${controlState(Boolean(error))} ${className ?? ""}`}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: FieldProps & ComponentProps<"textarea">) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        id={id}
        name={id}
        required={required}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${controlBase} ${controlState(Boolean(error))} ${className ?? ""}`}
        {...rest}
      />
    </FieldShell>
  );
}
