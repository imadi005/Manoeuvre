"use client";

import { useActionState, useState } from "react";
import type { LoginState } from "@/app/login/actions";

interface Field {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoCapitalize?: string;
  autoComplete?: string;
  required?: boolean;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7-10.5-7-10.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2C11 5.1 11.5 5 12 5c6.5 0 10.5 7 10.5 7a15.6 15.6 0 0 1-3.4 4.2M6.2 6.9A15.9 15.9 0 0 0 1.5 12s4 7 10.5 7c1.4 0 2.7-.3 3.9-.8" />
      <path d="M9.9 10a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function FieldInput({ f }: { f: Field }) {
  const [visible, setVisible] = useState(false);
  const isPassword = f.type === "password";

  return (
    <div className="relative">
      <input
        name={f.name}
        type={isPassword && visible ? "text" : (f.type ?? "text")}
        placeholder={f.placeholder}
        autoCapitalize={f.autoCapitalize ?? "off"}
        autoComplete={f.autoComplete ?? (isPassword ? "current-password" : "username")}
        required={f.required ?? true}
        className={`w-full border border-panel-line bg-void px-3 py-2.5 font-mono-fx text-sm text-fog outline-none transition-colors focus:border-cyan ${isPassword ? "pr-10" : ""}`}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-fog-dim transition-colors hover:text-cyan"
        >
          <EyeIcon open={visible} />
        </button>
      )}
    </div>
  );
}

export default function AuthForm({
  action,
  title,
  subtitle,
  fields,
  submitLabel,
}: {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
  title: string;
  subtitle: string;
  fields: Field[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <div className="box-glow-cyan mx-auto w-full max-w-sm border border-panel-line bg-panel/60 p-8">
      <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-cyan text-glow-cyan">
        // Access Terminal
      </p>
      <h1 className="font-display mt-2 text-2xl font-bold uppercase text-fog">{title}</h1>
      <p className="mt-1 font-body text-sm text-fog-dim">{subtitle}</p>

      <form action={formAction} className="mt-8 flex flex-col gap-5">
        {fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-2">
            <span className="font-mono-fx text-[11px] uppercase tracking-widest text-fog-dim">
              {f.label}
            </span>
            <FieldInput f={f} />
          </label>
        ))}

        {state.error && (
          <p className="font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">
            ⚠ {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 border border-yellow/70 bg-yellow py-2.5 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {pending ? "Authenticating..." : submitLabel}
        </button>
      </form>
    </div>
  );
}
