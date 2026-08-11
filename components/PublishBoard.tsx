"use client";

import { useState, useTransition } from "react";

interface VerifiedResult {
  id: string;
  eventName: string;
  first: string | null;
  second: string | null;
  third: string | null;
  fourth: string | null;
  facultyApprovedBy: string;
}

export default function PublishBoard({
  ready,
  publish,
}: {
  ready: VerifiedResult[];
  publish: (resultId: string) => Promise<{ error: string | null }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle(resultId: string) {
    setError(null);
    startTransition(async () => {
      const result = await publish(resultId);
      if (result.error) setError(result.error);
    });
  }

  if (ready.length === 0) {
    return <p className="font-body text-sm text-fog-dim">Nothing cross-checked and ready to publish yet.</p>;
  }

  return (
    <div>
      {error && (
        <p className="mb-4 font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">
          ⚠ {error}
        </p>
      )}
      <div className="flex flex-col gap-4">
        {ready.map((r) => (
          <div key={r.id} className="border border-cyan/40 bg-panel/50 p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-bold uppercase text-fog">{r.eventName}</h3>
              <span className="whitespace-nowrap font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                Faculty-approved by {r.facultyApprovedBy}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "1st", value: r.first },
                { label: "2nd", value: r.second },
                { label: "3rd", value: r.third },
                { label: "4th", value: r.fourth },
              ].map((p) => (
                <div key={p.label} className="border border-panel-line bg-void px-3 py-2 text-center">
                  <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">{p.label}</p>
                  <p className="mt-1 font-body text-sm text-fog">{p.value ?? "—"}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => handle(r.id)}
              disabled={isPending}
              className="mt-4 border border-yellow/70 bg-yellow px-6 py-2.5 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              Publish to Leaderboard & Close Event
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
