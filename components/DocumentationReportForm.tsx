"use client";

import { useActionState } from "react";
import { saveEventReport } from "@/app/dashboard/documentation/actions";

interface ExistingReport {
  summary: string | null;
  highlights: string | null;
  issues: string | null;
  updated_at: string;
}

export default function DocumentationReportForm({
  eventSlug,
  existing,
}: {
  eventSlug: string;
  existing: ExistingReport | null;
}) {
  const [state, formAction, pending] = useActionState(saveEventReport, { error: null });

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-panel-line pt-4">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
        // Documentation Write-Up {existing && <span className="text-cyan">— saved</span>}
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Summary</span>
        <textarea
          name="summary"
          defaultValue={existing?.summary ?? ""}
          rows={3}
          placeholder="What happened, how it ran, turnout..."
          className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Highlights (optional)</span>
        <textarea
          name="highlights"
          defaultValue={existing?.highlights ?? ""}
          rows={2}
          className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Issues / Notes (optional)</span>
        <textarea
          name="issues"
          defaultValue={existing?.issues ?? ""}
          rows={2}
          className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
        />
      </label>

      {state.error && (
        <p className="font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">
          ⚠ {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start border border-cyan/70 bg-cyan px-5 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save Report"}
      </button>
    </form>
  );
}
