"use client";

export default function PrintReportButton() {
  return (
    <button
      onClick={() => window.print()}
      className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-cyan"
    >
      Print / Save as PDF →
    </button>
  );
}
