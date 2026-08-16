"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getQuizStatus, saveAnswer, submitQuiz, reportFullscreenExit } from "@/app/dashboard/quiz/actions";
import type { QuizQuestion, EasterEgg } from "@/lib/quiz";

type Option = "A" | "B" | "C" | "D";
type Phase = "waiting" | "active" | "closed";
type GlitchKind = "banner" | "blackout" | "fade" | "hang";

const GLITCH_MESSAGES = [
  "⚠ CONNECTION UNSTABLE — RECONNECTING...",
  "SYSTEM ERROR — RECOVERING...",
  "⚠ PACKET LOSS DETECTED...",
  "MEMORY LEAK — STABILIZING...",
];

const GLITCH_KINDS: GlitchKind[] = ["banner", "blackout", "fade", "hang"];

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
  const [glitch, setGlitch] = useState<{ kind: GlitchKind; message: string } | null>(null);
  const [egg, setEgg] = useState<EasterEgg | null>(null);
  const [fullscreenEntered, setFullscreenEntered] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [, startTransition] = useTransition();

  const submittedRef = useRef(submitted);
  submittedRef.current = submitted;
  const scheduledRef = useRef(false);
  const eggTriggersRef = useRef<number[]>([]);
  const glitchTriggersRef = useRef<number[]>([]);
  const eggFiredCountRef = useRef(0);
  const glitchFiredCountRef = useRef(0);

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
      exitFullscreenIfActive();
      submitQuiz();
    }
  }, [remainingMs]);

  // Fullscreen-exit detection -- only while the quiz is actually live and the
  // student has entered fullscreen themselves (browsers require a user
  // gesture to request it, so this can't fire before that "Begin" click).
  useEffect(() => {
    if (phase !== "active" || !fullscreenEntered) return;
    function handleChange() {
      if (document.fullscreenElement) {
        setFullscreenWarning(false);
        return;
      }
      if (submittedRef.current) return;
      setFullscreenWarning(true);
      startTransition(() => {
        reportFullscreenExit();
      });
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, [phase, fullscreenEntered]);

  // Decide *which answered-question counts* trigger an easter egg or a
  // glitch, once, when the quiz goes active -- question-based, not
  // wall-clock-based, so it can't get skipped by finishing early/fast.
  useEffect(() => {
    if (phase !== "active" || !fullscreenEntered || scheduledRef.current) return;
    scheduledRef.current = true;

    const totalQ = questions.length;

    if (easterEggs.length > 0 && totalQ > 5) {
      const eggCount = Math.min(5, easterEggs.length);
      const picks = new Set<number>();
      while (picks.size < eggCount) {
        picks.add(3 + Math.floor(Math.random() * (totalQ - 5)));
      }
      eggTriggersRef.current = [...picks].sort((a, b) => a - b);
    }

    const glitchTriggers: number[] = [];
    let cursor = 4 + Math.floor(Math.random() * 3); // first one after 4-6 answers
    while (cursor < totalQ - 1) {
      glitchTriggers.push(cursor);
      cursor += 5 + Math.floor(Math.random() * 2); // then roughly every 5-6
    }
    glitchTriggersRef.current = glitchTriggers;
  }, [phase, fullscreenEntered, questions.length, easterEggs]);

  // Fire whichever thresholds the answered-count has now reached.
  useEffect(() => {
    if (phase !== "active" || !fullscreenEntered) return;
    const answeredCount = Object.keys(answers).length;

    while (
      eggFiredCountRef.current < eggTriggersRef.current.length &&
      answeredCount >= eggTriggersRef.current[eggFiredCountRef.current]
    ) {
      const pick = easterEggs[Math.floor(Math.random() * easterEggs.length)];
      setEgg(pick);
      eggFiredCountRef.current += 1;
    }

    while (
      glitchFiredCountRef.current < glitchTriggersRef.current.length &&
      answeredCount >= glitchTriggersRef.current[glitchFiredCountRef.current]
    ) {
      const kind = GLITCH_KINDS[Math.floor(Math.random() * GLITCH_KINDS.length)];
      const message = GLITCH_MESSAGES[Math.floor(Math.random() * GLITCH_MESSAGES.length)];
      setGlitch({ kind, message });
      const duration = kind === "fade" ? 2600 : kind === "hang" ? 2500 + Math.random() * 2000 : 3000 + Math.random() * 3000;
      setTimeout(() => setGlitch(null), duration);
      glitchFiredCountRef.current += 1;
    }
  }, [answers, phase, fullscreenEntered, easterEggs]);

  function handleSelect(questionNumber: number, option: Option) {
    setAnswers((prev) => ({ ...prev, [questionNumber]: option }));
    startTransition(() => {
      saveAnswer(questionNumber, option);
    });
  }

  function exitFullscreenIfActive() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function handleSubmit() {
    setSubmitted(true);
    exitFullscreenIfActive();
    startTransition(() => {
      submitQuiz();
    });
  }

  async function enterFullscreenAndBegin() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Unsupported or blocked (e.g. some mobile browsers) -- don't block the quiz over it.
    }
    setFullscreenEntered(true);
  }

  function handleReenterFullscreen() {
    document.documentElement.requestFullscreen().catch(() => {});
    setFullscreenWarning(false);
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

  if (!fullscreenEntered) {
    return (
      <div className="scanlines relative flex min-h-[50vh] flex-col items-center justify-center border border-magenta/40 bg-panel/40 p-10 text-center">
        <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-magenta text-glow-magenta">// Quiz Is Live</p>
        <p className="mt-4 font-display text-2xl font-bold uppercase text-fog">Enter fullscreen to begin</p>
        <p className="mt-3 max-w-sm font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
          The exam runs in fullscreen. Exiting fullscreen during the quiz is logged and flagged to your event lead.
        </p>
        <button
          onClick={enterFullscreenAndBegin}
          className="mt-6 border border-magenta/70 bg-magenta px-6 py-3 font-mono-fx text-sm font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02]"
        >
          Begin Quiz (Fullscreen)
        </button>
      </div>
    );
  }

  const remainingSec = Math.floor((remainingMs ?? 0) / 1000);
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, "0");
  const ss = String(remainingSec % 60).padStart(2, "0");
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="relative">
      {fullscreenWarning && (
        <div className="glitch-shake fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-void/95 p-6 text-center">
          <p className="font-mono-fx text-sm uppercase tracking-widest text-magenta text-glow-magenta">
            ⚠ Fullscreen exit detected — violation logged
          </p>
          <p className="max-w-sm font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
            Your event lead has been notified. Return to fullscreen to keep taking the quiz.
          </p>
          <button
            onClick={handleReenterFullscreen}
            className="border border-cyan/60 px-4 py-2 font-mono-fx text-xs uppercase tracking-widest text-cyan hover:bg-cyan hover:text-void"
          >
            Re-enter Fullscreen
          </button>
        </div>
      )}

      {glitch?.kind === "banner" && (
        <div className="glitch-shake fixed inset-0 z-40 flex items-center justify-center bg-void/90 backdrop-blur-sm">
          <p className="font-mono-fx text-sm uppercase tracking-widest text-magenta text-glow-magenta">{glitch.message}</p>
        </div>
      )}

      {glitch?.kind === "blackout" && <div className="glitch-blackout fixed inset-0 z-40 bg-void" />}

      {glitch?.kind === "fade" && <div className="glitch-fade fixed inset-0 z-40 bg-void" />}

      {glitch?.kind === "hang" && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="flex items-center gap-2 border border-fog-dim/40 bg-void/95 px-5 py-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-fog-dim" />
            <p className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
              Not Responding<span className="caret">_</span>
            </p>
          </div>
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

      <div className={glitch?.kind === "hang" ? "blur-[1.5px] grayscale contrast-125 transition-all" : "transition-all"}>
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
    </div>
  );
}
