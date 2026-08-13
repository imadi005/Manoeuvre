"use client";

import { useState, useTransition } from "react";

interface PendingReport {
  id: string;
  eventName: string;
  summary: string | null;
  objectives: string | null;
  outcome: string | null;
  feedback: string | null;
  webUrl: string | null;
  writtenBy: string;
}

export default function DocumentationApprovalBoard({
  pending,
  decide,
}: {
  pending: PendingReport[];
  decide: (reportId: string, approve: boolean, reason?: string) => Promise<{ error: string | null }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle(reportId: string, approve: boolean) {
    setError(null);
    let reason: string | undefined;
    if (!approve) {
      reason = window.prompt("Reason for sending this back?") ?? undefined;
      if (reason === undefined) return;
    }
    startTransition(async () => {
      const result = await decide(reportId, approve, reason);
      if (result.error) setError(result.error);
    });
  }

  if (pending.length === 0) {
    return <p className="font-body text-sm text-fog-dim">Nothing waiting here right now.</p>;
  }

  return (
    <div>
      {error && (
        <p className="mb-4 font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">⚠ {error}</p>
      )}
      <div className="flex flex-col gap-4">
        {pending.map((r) => (
          <div key={r.id} className="border border-panel-line bg-panel/50 p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-bold uppercase text-fog">{r.eventName}</h3>
              <span className="whitespace-nowrap font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                Written by {r.writtenBy}
              </span>
            </div>

            {r.objectives && (
              <div className="mt-3">
                <p className="font-mono-fx text-[10px] uppercase tracking-widest text-cyan">Objectives</p>
                <p className="mt-1 whitespace-pre-line font-body text-sm text-fog">{r.objectives}</p>
              </div>
            )}
            {r.summary && (
              <div className="mt-3">
                <p className="font-mono-fx text-[10px] uppercase tracking-widest text-cyan">Write-Up</p>
                <p className="mt-1 whitespace-pre-line font-body text-sm text-fog">{r.summary}</p>
              </div>
            )}
            {r.outcome && (
              <div className="mt-3">
                <p className="font-mono-fx text-[10px] uppercase tracking-widest text-cyan">Outcome</p>
                <p className="mt-1 whitespace-pre-line font-body text-sm text-fog">{r.outcome}</p>
              </div>
            )}
            {r.feedback && (
              <div className="mt-3">
                <p className="font-mono-fx text-[10px] uppercase tracking-widest text-cyan">Feedback</p>
                <p className="mt-1 whitespace-pre-line font-body text-sm text-fog">{r.feedback}</p>
              </div>
            )}
            {r.webUrl && (
              <div className="mt-3">
                <p className="font-mono-fx text-[10px] uppercase tracking-widest text-cyan">Web URL</p>
                <a href={r.webUrl} target="_blank" rel="noreferrer" className="mt-1 block font-body text-sm text-cyan underline">
                  {r.webUrl}
                </a>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => handle(r.id, true)}
                disabled={isPending}
                className="border border-cyan/70 bg-cyan px-5 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handle(r.id, false)}
                disabled={isPending}
                className="border border-magenta/70 px-5 py-2 font-mono-fx text-xs uppercase tracking-widest text-magenta transition-colors hover:bg-magenta hover:text-void disabled:opacity-50"
              >
                Send Back
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
