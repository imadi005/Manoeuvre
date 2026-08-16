"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getQuizStatus, saveAnswer, submitQuiz } from "@/app/dashboard/quiz/actions";
import type { QuizQuestion, EasterEgg } from "@/lib/quiz";

type Option = "A" | "B" | "C" | "D";
type Phase = "waiting" | "active" | "closed";

const GLITCH_MESSAGES = [
  "⚠ CONNECTION UNSTABLE — RECONNECTING...",
  "SYSTEM ERROR — RECOVERING...",
  "⚠ PACKET LOSS DETECTED...",
  "MEMORY LEAK — STABILIZING...",
];

function computeEndsAt(startedAt: string, durationMinutes: number): number {
  return new Date(startedAt).getTime() + durationMinutes * 60_000;
}

export default function QuizRunner({
  questions,
  initialAnswers,
  initialStartedAt,
  initialDurationMinutes,
  initialClosedAt,
  alreadySubmitted,
  easterEggs,
}: {
  questions: QuizQuestion[];
  initialAnswers: Record<number, Option>;
  initialStartedAt: string | null;
  initialDurationMinutes: number;
  initialClosedAt: string | null;
  alreadySubmitted: boolean;
  easterEggs: EasterEgg[];
}) {
  const [startedAt, setStartedAt] = useState(initialStartedAt);
  const [durationMinutes, setDurationMinutes] = useState(initialDurationMinutes);
  const [closedAt, setClosedAt] = useState(initialClosedAt);
  const [answers, setAnswers] = useState<Record<number, Option>>(initialAnswers);
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [glitch, setGlitch] = useState<string | null>(null);
  const [egg, setEgg] = useState<EasterEgg | null>(null);
  const [, startTransition] = useTransition();

  const submittedRef = useRef(submitted);
  submittedRef.current = submitted;
  const scheduledRef = useRef(false);

  const phase: Phase = submitted || closedAt ? "closed" : startedAt ? "active" : "waiting";

  // Poll for quiz status -- this is what makes "start" appear for everyone at once.
  useEffect(() => {
    if (phase === "closed") return;
    const id = setInterval(async () => {
      const status = await getQuizStatus();
      if (!status) return;
      setStartedAt(status.startedAt);
      setDurationMinutes(status.durationMinutes);
      setClosedAt(status.closedAt);
    }, 3000);
    return () => clearInterval(id);
  }, [phase]);

  // Countdown tick.
  useEffect(() => {
    if (!startedAt || phase === "closed") return;
    const endsAt = computeEndsAt(startedAt, durationMinutes);
    const tick = () => setRemainingMs(Math.max(endsAt - Date.now(), 0));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, durationMinutes, phase]);

  // Auto-submit when time's up.
  useEffect(() => {
    if (remainingMs === 0 && !submittedRef.current) {
      setSubmitted(true);
      submitQuiz();
    }
  }, [remainingMs]);

  // Schedule easter eggs + glitches once, when the quiz goes active.
  useEffect(() => {
    if (phase !== "active" || scheduledRef.current) return;
    scheduledRef.current = true;

    const windowMs = durationMinutes * 60_000;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (easterEggs.length > 0) {
      const eggCount = Math.min(2, easterEggs.length);
      for (let i = 0; i < eggCount; i++) {
        const delay = 20_000 + Math.random() * Math.max(windowMs - 40_000, 10_000);
        timers.push(
          setTimeout(() => {
            const pick = easterEggs[Math.floor(Math.random() * easterEggs.length)];
            setEgg(pick);
          }, delay)
        );
      }
    }

    const glitchCount = 2 + Math.floor(Math.random() * 3); // 2-4
    for (let i = 0; i < glitchCount; i++) {
      const delay = 15_000 + Math.random() * Math.max(windowMs - 30_000, 10_000);
      timers.push(
        setTimeout(() => {
          setGlitch(GLITCH_MESSAGES[Math.floor(Math.random() * GLITCH_MESSAGES.length)]);
          setTimeout(() => setGlitch(null), 3000 + Math.random() * 3000);
        }, delay)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [phase, durationMinutes, easterEggs]);

  function handleSelect(questionNumber: number, option: Option) {
    setAnswers((prev) => ({ ...prev, [questionNumber]: option }));
    startTransition(() => {
      saveAnswer(questionNumber, option);
    });
  }

  function handleSubmit() {
    setSubmitted(true);
    startTransition(() => {
      submitQuiz();
    });
  }

  if (phase === "waiting") {
    return (
      <div className="scanlines relative flex min-h-[50vh] flex-col items-center justify-center border border-panel-line bg-panel/40 p-10 text-center">
        <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-cyan text-glow-cyan">// Standing By</p>
        <p className="mt-4 font-display text-2xl font-bold uppercase text-fog">Waiting for the quiz to start</p>
        <p className="mt-3 font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
          Your screen will switch automatically — no need to refresh.
        </p>
      </div>
    );
  }

  if (phase === "closed") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center border border-cyan/40 bg-panel/40 p-10 text-center">
        <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-cyan text-glow-cyan">// Submitted</p>
        <p className="mt-4 font-display text-2xl font-bold uppercase text-fog">Thanks for playing.</p>
        <p className="mt-3 font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
          Results will be announced by your event lead.
        </p>
      </div>
    );
  }

  const remainingSec = Math.floor((remainingMs ?? 0) / 1000);
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, "0");
  const ss = String(remainingSec % 60).padStart(2, "0");
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="relative">
      {glitch && (
        <div className="glitch-shake fixed inset-0 z-40 flex items-center justify-center bg-void/90 backdrop-blur-sm">
          <p className="font-mono-fx text-sm uppercase tracking-widest text-magenta text-glow-magenta">{glitch}</p>
        </div>
      )}

      {egg && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-void/95 p-6"
          onClick={() => setEgg(null)}
        >
          <img src={egg.url} alt="" className="max-h-[70vh] max-w-full border border-cyan/40 object-contain" />
          <button className="border border-cyan/60 px-4 py-2 font-mono-fx text-xs uppercase tracking-widest text-cyan hover:bg-cyan hover:text-void">
            Tap to dismiss
          </button>
        </div>
      )}

      <div className="sticky top-16 z-30 mb-6 flex flex-wrap items-center justify-between gap-3 border border-panel-line bg-void/95 px-4 py-3 backdrop-blur">
        <span className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
          {answeredCount}/{questions.length} answered
        </span>
        <span className="font-display text-xl font-black tabular-nums text-cyan text-glow-cyan">
          {mm}:{ss}
        </span>
        <button
          onClick={handleSubmit}
          className="border border-magenta/70 bg-magenta px-4 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02]"
        >
          Submit
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {questions.map((q) => (
          <div key={q.id} className="border border-panel-line bg-panel/40 p-4">
            <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
              Q{q.questionNumber}
              {q.sectionLabel ? ` · ${q.sectionLabel}` : ""}
            </p>
            <p className="mt-2 font-body text-sm text-fog whitespace-pre-line">{q.questionText}</p>
            <div className="mt-3 flex flex-col gap-2">
              {([
                ["A", q.optionA],
                ["B", q.optionB],
                ["C", q.optionC],
                ["D", q.optionD],
              ] as [Option, string][]).map(([opt, text]) => (
                <button
                  key={opt}
                  onClick={() => handleSelect(q.questionNumber, opt)}
                  className={`border px-3 py-2 text-left font-body text-sm transition-colors ${
                    answers[q.questionNumber] === opt
                      ? "border-cyan bg-cyan/10 text-cyan"
                      : "border-panel-line text-fog hover:border-cyan/50"
                  }`}
                >
                  <span className="font-mono-fx text-xs text-fog-dim">{opt}.</span> {text}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        className="mt-6 w-full border border-magenta/70 bg-magenta py-3 font-mono-fx text-sm font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.01]"
      >
        Submit Quiz
      </button>
    </div>
  );
}
