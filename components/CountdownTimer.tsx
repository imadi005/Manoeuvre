"use client";

import { useEffect, useState } from "react";

function getRemaining(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  const clamped = Math.max(diff, 0);
  return {
    days: Math.floor(clamped / 86_400_000),
    hours: Math.floor((clamped / 3_600_000) % 24),
    minutes: Math.floor((clamped / 60_000) % 60),
    seconds: Math.floor((clamped / 1000) % 60),
    done: diff <= 0,
  };
}

export default function CountdownTimer({ target, label }: { target: string; label: string }) {
  const [time, setTime] = useState<ReturnType<typeof getRemaining> | null>(null);

  useEffect(() => {
    setTime(getRemaining(target));
    const id = setInterval(() => setTime(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const units = [
    { value: time?.days, label: "Days" },
    { value: time?.hours, label: "Hrs" },
    { value: time?.minutes, label: "Min" },
    { value: time?.seconds, label: "Sec" },
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="font-mono-fx text-[11px] uppercase tracking-[0.35em] text-fog-dim">
        {time?.done ? "System live" : label}
      </span>
      <div className="flex gap-3 sm:gap-4">
        {units.map((u) => (
          <div
            key={u.label}
            className="flex w-16 flex-col items-center border border-panel-line bg-panel/60 py-2.5 box-glow-cyan sm:w-20"
          >
            <span className="font-display text-2xl text-cyan text-glow-cyan sm:text-3xl tabular-nums">
              {u.value !== undefined ? String(u.value).padStart(2, "0") : "--"}
            </span>
            <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
              {u.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
