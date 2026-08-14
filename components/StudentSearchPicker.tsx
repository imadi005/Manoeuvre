"use client";

import { useState } from "react";

interface Candidate {
  id: string;
  name: string;
  rollNumber: string;
  eventCount: number;
  conflictName: string | null;
}

export default function StudentSearchPicker({
  candidates,
  onPick,
  disabled,
}: {
  candidates: Candidate[];
  onPick: (studentId: string) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? candidates.filter((c) => c.name.toLowerCase().includes(q) || c.rollNumber.toLowerCase().includes(q))
    : candidates;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or roll number..."
        disabled={disabled}
        className="w-full border border-panel-line bg-void px-3 py-2.5 font-mono-fx text-sm text-fog outline-none focus:border-cyan disabled:opacity-40"
      />
      <div className="mt-2 max-h-64 overflow-y-auto border border-panel-line/60">
        {filtered.length === 0 && (
          <p className="p-3 font-body text-xs text-fog-dim">No matching students.</p>
        )}
        {filtered.slice(0, 50).map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={disabled || !!c.conflictName}
            onClick={() => {
              onPick(c.id);
              setQuery("");
            }}
            className="flex w-full items-center justify-between gap-2 border-b border-panel-line/40 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <span className="font-body text-sm text-fog">
              {c.name} <span className="font-mono-fx text-xs text-fog-dim">· {c.rollNumber}</span>
            </span>
            <span className={`whitespace-nowrap font-mono-fx text-[10px] uppercase tracking-widest ${c.conflictName ? "text-magenta" : "text-fog-dim"}`}>
              {c.conflictName ? `Clashes: ${c.conflictName}` : `${c.eventCount} event${c.eventCount === 1 ? "" : "s"} so far`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
