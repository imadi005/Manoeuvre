"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { onGroundWeek, finaleSchedule, type ScheduleBlock } from "@/lib/schedule";
import { events } from "@/lib/data";

function eventName(slug: string): string {
  return events.find((e) => e.slug === slug)?.name ?? slug;
}

interface Tab {
  label: string;
  sub: string;
  blocks: ScheduleBlock[];
  accent: "cyan" | "yellow";
  /** A day with zero blocks because everything on it got postponed, not because it was always empty — gets a wink instead of a blank panel. */
  postponedMessage?: string;
}

const tabs: Tab[] = [
  ...onGroundWeek.map((d) => ({
    label: d.dayLabel,
    sub: d.date,
    blocks: d.blocks,
    accent: "cyan" as const,
    postponedMessage:
      d.blocks.length === 0
        ? "// BLACK DAY DECLARED\nA higher power intervened. Events relocated to 19/20 Aug while reality stabilizes."
        : undefined,
  })),
  { label: "Finale", sub: "24 Aug", blocks: finaleSchedule, accent: "yellow" as const },
];

function defaultTabIndex(): number {
  const now = new Date();
  const year = now.getFullYear();
  if (year === 2026) {
    const day = now.getDate();
    const month = now.getMonth(); // 7 = August
    if (month === 7 && day >= 17 && day <= 22) return day - 17;
    if (month === 7 && day === 24) return tabs.length - 1;
  }
  return 0;
}

export default function ScheduleTeaser() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(defaultTabIndex());
  }, []);

  const tab = tabs[active];
  const accentClass = tab.accent === "yellow" ? "text-yellow text-glow-yellow" : "text-cyan text-glow-cyan";
  const borderClass = tab.accent === "yellow" ? "border-yellow" : "border-cyan";

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={`flex-shrink-0 border px-4 py-2 font-mono-fx text-xs uppercase tracking-widest transition-colors ${
              i === active
                ? t.accent === "yellow"
                  ? "border-yellow bg-yellow text-void"
                  : "border-cyan bg-cyan text-void"
                : "border-panel-line text-fog-dim hover:text-fog"
            }`}
          >
            {t.label} <span className="opacity-70">· {t.sub}</span>
          </button>
        ))}
      </div>

      <div className={`mt-5 border ${borderClass}/30 bg-panel/40 p-5`}>
        <AnimatePresence initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3"
          >
            {tab.postponedMessage ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                {tab.postponedMessage.split("\n").map((line, i) => (
                  <p
                    key={i}
                    className={
                      i === 0
                        ? "font-mono-fx text-xs font-bold uppercase tracking-widest text-magenta text-glow-magenta"
                        : "max-w-sm font-body text-sm text-fog-dim"
                    }
                  >
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              tab.blocks.map((b, i) => (
              <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
                <span className={`w-40 flex-shrink-0 font-mono-fx text-xs ${accentClass}`}>{b.time}</span>
                <span className={`font-body text-sm ${b.isBreak ? "italic text-fog-dim" : "text-fog"}`}>
                  {b.eventSlugs ? (
                    b.eventSlugs.map((slug, j) => (
                      <span key={slug}>
                        {j > 0 && " · "}
                        <Link href={`/events/${slug}`} className="hover:underline">
                          {eventName(slug)}
                        </Link>
                        {b.eventRoundLabels?.[j] && (
                          <span className="ml-1 font-mono-fx text-[10px] uppercase text-fog-dim">
                            ({b.eventRoundLabels[j]})
                          </span>
                        )}
                      </span>
                    ))
                  ) : b.eventSlug ? (
                    <Link href={`/events/${b.eventSlug}`} className="hover:underline">
                      {b.title}
                    </Link>
                  ) : (
                    b.title
                  )}
                </span>
                {b.venue && (
                  <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                    {b.venue}
                  </span>
                )}
              </div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-5 text-center">
        <Link
          href="/schedule"
          className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-cyan"
        >
          View Full Schedule →
        </Link>
      </div>
    </div>
  );
}
