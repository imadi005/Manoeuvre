"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getQuizStatus, saveAnswer, submitQuiz, reportFullscreenExit } from "@/app/dashboard/quiz/actions";
import type { QuizQuestion, EasterEgg } from "@/lib/quiz";

type Option = "A" | "B" | "C" | "D";
type Phase = "waiting" | "active" | "closed";
type GlitchKind = "bsod" | "blank" | "heavyglitch" | "winshutdown";

const GLITCH_KINDS: GlitchKind[] = ["bsod", "blank", "heavyglitch", "winshutdown"];
const GLITCH_DURATION_MS: Record<GlitchKind, number> = {
  bsod: 10_000,
  blank: 5_000,
  heavyglitch: 5_000,
  winshutdown: 5_000,
};

const DODGE_RADIUS = 90;
const DODGE_WINDOW_MS = 8_000;
const DODGE_THROTTLE_MS = 40;

function computeEndsAt(startedAt: string, durationMinutes: number): number {
  return new Date(startedAt).getTime() + durationMinutes * 60_000;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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
  const [glitch, setGlitch] = useState<GlitchKind | null>(null);
  const [bsodPercent, setBsodPercent] = useState(0);
  const [egg, setEgg] = useState<EasterEgg | null>(null);
  const [fullscreenEntered, setFullscreenEntered] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [dodgeOffsets, setDodgeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [, startTransition] = useTransition();

  const submittedRef = useRef(submitted);
  submittedRef.current = submitted;
  const scheduledRef = useRef(false);
  const eggTriggersRef = useRef<number[]>([]);
  const eggOrderRef = useRef<EasterEgg[]>([]);
  const glitchTriggersRef = useRef<number[]>([]);
  const eggFiredCountRef = useRef(0);
  const glitchFiredCountRef = useRef(0);
  const dodgeQuestionsRef = useRef<number[]>([]);
  const dodgeArmedRef = useRef<Record<number, boolean>>({});
  const dodgeStartedAtRef = useRef<Record<number, number>>({});
  const dodgeButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dodgeLastMoveRef = useRef(0);

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
  // glitch, plus which 2 questions get the dodge-the-cursor prank -- all
  // decided once, when the quiz goes active. Question-based, not
  // wall-clock-based, so nothing can get skipped by finishing early/fast.
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
      // Shuffle once so each trigger shows a different egg -- no repeats until all are seen.
      eggOrderRef.current = [...easterEggs].sort(() => Math.random() - 0.5).slice(0, eggCount);
    }

    const glitchTriggers: number[] = [];
    let cursor = 4 + Math.floor(Math.random() * 3); // first one after 4-6 answers
    while (cursor < totalQ - 1) {
      glitchTriggers.push(cursor);
      cursor += 5 + Math.floor(Math.random() * 2); // then roughly every 5-6
    }
    glitchTriggersRef.current = glitchTriggers;

    if (totalQ > 10) {
      const dodgePicks = new Set<number>();
      while (dodgePicks.size < 2) {
        dodgePicks.add(questions[3 + Math.floor(Math.random() * (totalQ - 6))].questionNumber);
      }
      dodgeQuestionsRef.current = [...dodgePicks];
      for (const q of dodgeQuestionsRef.current) dodgeArmedRef.current[q] = true;
    }
  }, [phase, fullscreenEntered, questions, easterEggs]);

  // Fire whichever thresholds the answered-count has now reached.
  useEffect(() => {
    if (phase !== "active" || !fullscreenEntered) return;
    const answeredCount = Object.keys(answers).length;

    while (
      eggFiredCountRef.current < eggTriggersRef.current.length &&
      answeredCount >= eggTriggersRef.current[eggFiredCountRef.current]
    ) {
      const pick = eggOrderRef.current[eggFiredCountRef.current];
      if (pick) setEgg(pick);
      eggFiredCountRef.current += 1;
    }

    while (
      glitchFiredCountRef.current < glitchTriggersRef.current.length &&
      answeredCount >= glitchTriggersRef.current[glitchFiredCountRef.current]
    ) {
      const kind = GLITCH_KINDS[Math.floor(Math.random() * GLITCH_KINDS.length)];
      setGlitch(kind);
      if (kind === "bsod") {
        setBsodPercent(0);
        let pct = 0;
        const bsodTimer = setInterval(() => {
          pct = Math.min(100, pct + 3 + Math.floor(Math.random() * 9));
          setBsodPercent(pct);
          if (pct >= 100) clearInterval(bsodTimer);
        }, 350);
      }
      setTimeout(() => setGlitch(null), GLITCH_DURATION_MS[kind]);
      glitchFiredCountRef.current += 1;
    }
  }, [answers, phase, fullscreenEntered]);

  // Dodge-the-cursor prank: on the 2 chosen questions, option buttons jump
  // away from the mouse for up to 8s (from the first time the cursor gets
  // close), then settle so the question stays answerable.
  useEffect(() => {
    if (phase !== "active" || !fullscreenEntered || dodgeQuestionsRef.current.length === 0) return;

    function handleMove(e: MouseEvent) {
      const now = Date.now();
      if (now - dodgeLastMoveRef.current < DODGE_THROTTLE_MS) return;
      dodgeLastMoveRef.current = now;

      for (const qNum of dodgeQuestionsRef.current) {
        if (!dodgeArmedRef.current[qNum]) continue;

        for (const opt of ["A", "B", "C", "D"] as Option[]) {
          const key = `${qNum}-${opt}`;
          const el = dodgeButtonRefs.current[key];
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
          if (dist >= DODGE_RADIUS) continue;

          if (!dodgeStartedAtRef.current[qNum]) dodgeStartedAtRef.current[qNum] = now;
          const angle = Math.atan2(cy - e.clientY, cx - e.clientX);
          const mag = 55 + Math.random() * 55;
          setDodgeOffsets((prev) => ({
            ...prev,
            [key]: { x: clamp(Math.cos(angle) * mag, -110, 110), y: clamp(Math.sin(angle) * mag, -50, 50) },
          }));
        }

        if (dodgeStartedAtRef.current[qNum] && now - dodgeStartedAtRef.current[qNum] > DODGE_WINDOW_MS) {
          dodgeArmedRef.current[qNum] = false;
          setDodgeOffsets((prev) => {
            const next = { ...prev };
            for (const opt of ["A", "B", "C", "D"]) delete next[`${qNum}-${opt}`];
            return next;
          });
        }
      }
    }

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [phase, fullscreenEntered]);

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

      {glitch === "bsod" && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#0078d7] px-6 text-white">
          <p className="text-8xl font-light">:(</p>
          <p className="mt-6 max-w-lg text-lg leading-snug">
            Your PC ran into a problem and needs to restart. We&apos;re just collecting some error info, and then we&apos;ll restart for you.
          </p>
          <p className="mt-6 text-lg">{bsodPercent}% complete</p>
          <p className="mt-10 max-w-md text-sm opacity-90">
            For more information about this issue and possible fixes, visit https://www.windows.com/stopcode
          </p>
          <p className="mt-2 text-sm opacity-80">Stop code: QUIZ_PANIC_EXCEPTION</p>
        </div>
      )}

      {glitch === "blank" && <div className="fixed inset-0 z-[60] bg-black" />}

      {glitch === "heavyglitch" && (
        <div className="heavy-glitch-hue fixed inset-0 z-[60] overflow-hidden bg-void">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="heavy-glitch-band"
              style={{
                top: `${i * 10}%`,
                height: `${8 + Math.random() * 6}%`,
                animationDelay: `${(i % 5) * 0.05}s`,
              }}
            />
          ))}
        </div>
      )}

      {glitch === "winshutdown" && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-black">
          <div className="relative h-16 w-16">
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * 2 * Math.PI;
              const r = 26;
              const x = 32 + r * Math.cos(angle) - 3;
              const y = 32 + r * Math.sin(angle) - 3;
              return (
                <span
                  key={i}
                  className="winspin-dot absolute h-1.5 w-1.5 rounded-full bg-white"
                  style={{ left: x, top: y, animationDelay: `${i * 0.12}s` }}
                />
              );
            })}
          </div>
          <p className="text-lg text-white">Shutting down</p>
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

      <div>
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
                ] as [Option, string][]).map(([opt, text]) => {
                  const dodgeKey = `${q.questionNumber}-${opt}`;
                  const offset = dodgeOffsets[dodgeKey];
                  return (
                    <button
                      key={opt}
                      ref={(el) => {
                        dodgeButtonRefs.current[dodgeKey] = el;
                      }}
                      onClick={() => handleSelect(q.questionNumber, opt)}
                      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)`, transition: "transform 0.12s ease-out" } : undefined}
                      className={`relative border px-3 py-2 text-left font-body text-sm transition-colors ${
                        answers[q.questionNumber] === opt
                          ? "border-cyan bg-cyan/10 text-cyan"
                          : "border-panel-line text-fog hover:border-cyan/50"
                      }`}
                    >
                      <span className="font-mono-fx text-xs text-fog-dim">{opt}.</span> {text}
                    </button>
                  );
                })}
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
