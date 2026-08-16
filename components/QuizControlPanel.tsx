"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { startQuiz, endQuizNow, autoAdvanceTopScorers, getQuizLiveStatus, type QuizLiveStatus } from "@/app/dashboard/event-lead/quizActions";

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
  const [live, setLive] = useState<QuizLiveStatus | null>(null);

  const effectiveStartedAt = live?.startedAt ?? startedAt;
  const effectiveClosedAt = live?.closedAt ?? closedAt;
  const effectiveSubmittedCount = live?.submittedCount ?? submittedCount;
  const violations = live?.violations ?? [];

  // Poll live status while the quiz is running -- submitted count + fullscreen-exit violations, per student.
  useEffect(() => {
    if (!effectiveStartedAt) return;
    const id = setInterval(async () => {
      const status = await getQuizLiveStatus();
      if (status) setLive(status);
    }, 5000);
    return () => clearInterval(id);
  }, [effectiveStartedAt]);

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
        {!effectiveStartedAt ? (
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
        ) : effectiveClosedAt ? (
          <span className="font-mono-fx text-xs uppercase tracking-widest text-cyan">Quiz closed</span>
        ) : (
          <>
            <span className="font-mono-fx text-xs uppercase tracking-widest text-cyan">
              Live — {effectiveSubmittedCount}/{totalRegistered} submitted
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

      {effectiveStartedAt && !effectiveClosedAt && (
        <div className="mt-4 border-t border-panel-line/60 pt-4">
          <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
            // Fullscreen Violations {violations.length > 0 && <span className="text-magenta">({violations.length} student{violations.length === 1 ? "" : "s"})</span>}
          </p>
          {violations.length === 0 ? (
            <p className="mt-2 font-body text-xs text-fog-dim">None yet — everyone's staying in the exam view.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {violations.map((v) => (
                <p key={v.studentId} className="font-mono-fx text-[10px] uppercase tracking-widest text-fog">
                  {v.studentName} <span className="text-fog-dim">({v.rollNumber})</span>{" "}
                  <span className="text-magenta">— exited {v.count}×</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {effectiveClosedAt && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => run(() => autoAdvanceTopScorers(16))}
            disabled={isPending}
            className="border border-cyan/60 px-4 py-2 font-mono-fx text-xs uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-40"
          >
            Auto-Advance Top 16 Scorers
          </button>
          <Link
            href="/dashboard/event-lead/quiz-scores"
            className="border border-yellow/60 px-4 py-2 font-mono-fx text-xs uppercase tracking-widest text-yellow transition-colors hover:bg-yellow hover:text-void"
          >
            View Scorecard →
          </Link>
        </div>
      )}
      {effectiveClosedAt && (
        <p className="mt-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
          Auto-advance pre-fills Round 1 for the top 16 — adjust manually below if needed.
        </p>
      )}

      <p className="mt-5 border-t border-panel-line/60 pt-4 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
        Easter-egg images/GIFs — {easterEggCount} loaded
      </p>
    </div>
  );
}
