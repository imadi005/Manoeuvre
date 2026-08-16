"use client";

import { useState, useTransition } from "react";

interface PendingResult {
  id: string;
  eventName: string;
  first: string | null;
  second: string | null;
  third: string | null;
  notes: string | null;
  submittedBy: string;
}

export default function ResultVerificationBoard({
  pending,
  decide,
  approveLabel = "Approve",
  rejectLabel = "Reject",
  submittedByLabel = "Submitted by",
  askReasonOnReject = false,
}: {
  pending: PendingResult[];
  decide: (resultId: string, approve: boolean, reason?: string) => Promise<{ error: string | null }>;
  approveLabel?: string;
  rejectLabel?: string;
  submittedByLabel?: string;
  askReasonOnReject?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle(resultId: string, approve: boolean) {
    setError(null);
    let reason: string | undefined;
    if (!approve && askReasonOnReject) {
      reason = window.prompt("Reason for sending this back?") ?? undefined;
      if (reason === undefined) return; // cancelled
    }
    startTransition(async () => {
      const result = await decide(resultId, approve, reason);
      if (result.error) setError(result.error);
    });
  }

  if (pending.length === 0) {
    return (
      <p className="font-body text-sm text-fog-dim">
        Nothing waiting here right now.
      </p>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-4 font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">
          ⚠ {error}
        </p>
      )}
      <div className="flex flex-col gap-4">
        {pending.map((r) => (
          <div key={r.id} className="border border-panel-line bg-panel/50 p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-bold uppercase text-fog">{r.eventName}</h3>
              <span className="whitespace-nowrap font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                {submittedByLabel} {r.submittedBy}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { label: "Winner", value: r.first },
                { label: "Runner-Up", value: r.second },
                { label: "3rd", value: r.third },
              ].map((p) => (
                <div key={p.label} className="border border-panel-line bg-void px-3 py-2 text-center">
                  <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                    {p.label}
                  </p>
                  <p className="mt-1 font-body text-sm text-fog">{p.value ?? "—"}</p>
                </div>
              ))}
            </div>
            {r.notes && <p className="mt-3 font-body text-sm italic text-fog-dim">&ldquo;{r.notes}&rdquo;</p>}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => handle(r.id, true)}
                disabled={isPending}
                className="border border-cyan/70 bg-cyan px-5 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {approveLabel}
              </button>
              <button
                onClick={() => handle(r.id, false)}
                disabled={isPending}
                className="border border-magenta/70 px-5 py-2 font-mono-fx text-xs uppercase tracking-widest text-magenta transition-colors hover:bg-magenta hover:text-void disabled:opacity-50"
              >
                {rejectLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
