"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface RosterMember {
  roll_number: string;
  name: string;
}

const PREVIEW_COUNT = 9;

export default function RosterList({
  roster,
  accent,
}: {
  roster: RosterMember[];
  accent: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = roster.length > PREVIEW_COUNT;
  const visible = expanded ? roster : roster.slice(0, PREVIEW_COUNT);

  return (
    <div style={{ "--accent": accent } as React.CSSProperties}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {visible.map((s) => (
            <motion.div
              key={s.roll_number}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              whileHover={{ y: -2 }}
              className="hover-glow-accent group flex items-center justify-between gap-3 border border-panel-line bg-panel/40 px-4 py-3"
            >
              <span className="group-hover-glow-accent font-body text-sm text-fog transition-colors">
                {s.name}
              </span>
              <span className="font-mono-fx text-[11px] text-fog-dim">{s.roll_number}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="hover-text-glow-accent mt-5 flex items-center gap-2 font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors"
        >
          {expanded ? "Show less" : `Show all ${roster.length} operatives`}
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            ▾
          </motion.span>
        </button>
      )}
    </div>
  );
}
