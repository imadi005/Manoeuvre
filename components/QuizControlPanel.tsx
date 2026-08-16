"use client";

import { useState, useTransition, useActionState, useRef } from "react";
import { startQuiz, endQuizNow, uploadEasterEgg, autoAdvanceTopScorers } from "@/app/dashboard/event-lead/quizActions";

export default function QuizControlPanel({
  startedAt,
  closedAt,
  submittedCount,
  totalRegistered,
  easterEggCount,
}: {
  startedAt: string | null;
  closedAt: string | null;
  submittedCount: number;
  totalRegistered: number;
  easterEggCount: number;
}) {
  const [duration, setDuration] = useState(40);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="border border-magenta/30 bg-panel/40 p-5">
      <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-magenta text-glow-magenta">
        // IT Manager Quiz — Round 1
      </p>

      {error && (
        <p className="mt-3 border border-magenta/40 bg-magenta/10 px-3 py-2 font-mono-fx text-xs uppercase tracking-wide text-magenta">
          ⚠ {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!startedAt ? (
          <>
            <label className="flex items-center gap-2 font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
              Duration (min)
              <input
                type="number"
                min={1}
                max={180}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-16 border border-panel-line bg-void px-2 py-1 text-fog"
              />
            </label>
            <button
              onClick={() => run(() => startQuiz(duration))}
              disabled={isPending}
              className="border border-yellow/70 bg-yellow px-4 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              Start Quiz
            </button>
          </>
        ) : closedAt ? (
          <span className="font-mono-fx text-xs uppercase tracking-widest text-cyan">Quiz closed</span>
        ) : (
          <>
            <span className="font-mono-fx text-xs uppercase tracking-widest text-cyan">
              Live — {submittedCount}/{totalRegistered} submitted
            </span>
            <button
              onClick={() => run(endQuizNow)}
              disabled={isPending}
              className="border border-magenta/70 px-4 py-2 font-mono-fx text-xs uppercase tracking-widest text-magenta transition-colors hover:bg-magenta hover:text-void disabled:opacity-40"
            >
              End Quiz Now
            </button>
          </>
        )}
      </div>

      {closedAt && (
        <div className="mt-4">
          <button
            onClick={() => run(() => autoAdvanceTopScorers(16))}
            disabled={isPending}
            className="border border-cyan/60 px-4 py-2 font-mono-fx text-xs uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-40"
          >
            Auto-Advance Top 16 Scorers
          </button>
          <p className="mt-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
            Pre-fills Round 1 Advance for the top 16 — adjust manually below if needed.
          </p>
        </div>
      )}

      <EasterEggUpload count={easterEggCount} />
    </div>
  );
}

function EasterEggUpload({ count }: { count: number }) {
  const [state, formAction, pending] = useActionState(uploadEasterEgg, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="mt-5 border-t border-panel-line/60 pt-4">
      <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
        Easter-egg images/GIFs — {count} uploaded
      </p>
      <form
        ref={formRef}
        action={(fd) => {
          formAction(fd);
          formRef.current?.reset();
        }}
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <input
          type="file"
          name="file"
          accept="image/*"
          required
          disabled={pending}
          className="border border-panel-line bg-void px-2 py-1.5 font-mono-fx text-xs text-fog file:mr-2 file:border-0 file:bg-cyan file:px-2 file:py-1 file:font-mono-fx file:text-[10px] file:uppercase file:text-void disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={pending}
          className="border border-cyan/60 px-3 py-1.5 font-mono-fx text-[10px] uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-40"
        >
          {pending ? "Uploading..." : "Upload"}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 font-mono-fx text-[10px] uppercase tracking-wide text-magenta">⚠ {state.error}</p>
      )}
    </div>
  );
}
