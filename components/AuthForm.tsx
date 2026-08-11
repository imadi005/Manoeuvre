"use client";

import { useActionState } from "react";
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
            <input
              name={f.name}
              type={f.type ?? "text"}
              placeholder={f.placeholder}
              autoCapitalize={f.autoCapitalize ?? "off"}
              autoComplete={f.autoComplete ?? (f.type === "password" ? "current-password" : "username")}
              required={f.required ?? true}
              className="border border-panel-line bg-void px-3 py-2.5 font-mono-fx text-sm text-fog outline-none transition-colors focus:border-cyan"
            />
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
