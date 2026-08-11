"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { factions } from "@/lib/data";
import { useIsMobile } from "@/lib/useIsMobile";

interface Pin {
  x: number;
  y: number;
}

// Scattered "territory" positions across the map.
const LAYOUT_DESKTOP: Pin[] = [
  { x: 10, y: 25 },
  { x: 35, y: 18 },
  { x: 60, y: 27 },
  { x: 88, y: 20 },
  { x: 15, y: 75 },
  { x: 40, y: 82 },
  { x: 65, y: 73 },
  { x: 90, y: 80 },
];

const LAYOUT_MOBILE: Pin[] = [
  { x: 28, y: 8 },
  { x: 72, y: 10 },
  { x: 25, y: 32 },
  { x: 75, y: 30 },
  { x: 30, y: 55 },
  { x: 70, y: 53 },
  { x: 27, y: 78 },
  { x: 73, y: 80 },
];

// Network mesh — ring + cross diagonals, index-based so it works for either layout.
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 7], [7, 6], [6, 5], [5, 4], [4, 0],
  [0, 5], [1, 4], [2, 7], [3, 6],
];

export default function FactionTerritoryMap() {
  const isMobile = useIsMobile();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (isMobile === null) {
    return <div className="h-[420px] w-full sm:h-[560px]" />;
  }

  const layout = isMobile ? LAYOUT_MOBILE : LAYOUT_DESKTOP;

  return (
    <div>
      <div className={`relative w-full overflow-hidden border border-panel-line ${isMobile ? "h-[560px]" : "h-[560px]"}`}>
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-70" />

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {EDGES.map(([a, b], i) => (
            <line
              key={i}
              x1={layout[a].x}
              y1={layout[a].y}
              x2={layout[b].x}
              y2={layout[b].y}
              stroke="#3ee9e6"
              strokeWidth="0.15"
              strokeOpacity="0.35"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {factions.map((faction, i) => {
          const pos = layout[i];
          return (
            <button
              key={faction.slug}
              onClick={() => setOpenIndex(i)}
              style={
                {
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  "--accent": faction.accent,
                } as React.CSSProperties
              }
              className="group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
            >
              <div className="bg-glow-accent pointer-events-none absolute -inset-8 opacity-70 transition-opacity group-hover:opacity-100" />
              <div className="relative flex flex-col items-center gap-1.5">
                <span
                  className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full transition-transform group-hover:scale-125"
                  style={{ backgroundColor: "var(--accent)", boxShadow: "0 0 10px 3px var(--accent)" }}
                >
                  <span className="absolute h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: "var(--accent)" }} />
                </span>
                <span
                  className="font-mono-fx whitespace-nowrap text-[10px] font-bold uppercase tracking-widest transition-colors sm:text-xs"
                  style={{ color: "var(--accent)" }}
                >
                  {faction.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {openIndex !== null && (
          <TerritoryLightbox index={openIndex} onClose={() => setOpenIndex(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function TerritoryLightbox({ index, onClose }: { index: number; onClose: () => void }) {
  const faction = factions[index];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-void/90 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 font-mono-fx text-sm uppercase tracking-widest text-fog-dim hover:text-fog"
      >
        ✕ Close
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{ "--accent": faction.accent } as React.CSSProperties}
        className="hover-glow-accent flex w-full max-w-xs flex-col items-center border border-panel-line bg-panel/60 p-6 text-center"
      >
        <div className="relative aspect-square w-full max-w-[220px]">
          <Image src={faction.logo} alt={`${faction.name} emblem`} fill sizes="220px" className="object-contain" priority />
        </div>
        <h3 className="text-glow-accent font-display mt-4 text-xl font-bold uppercase">{faction.name}</h3>
        <p className="mt-2 font-body text-sm italic text-fog">&ldquo;{faction.tagline}&rdquo;</p>
        <p className="mt-3 font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
          Coord. {faction.heads[0]} · Coord. {faction.heads[1]}
        </p>
        <Link
          href={`/factions/${faction.slug}`}
          className="mt-5 border border-yellow/70 bg-yellow px-6 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-105"
        >
          View Faction →
        </Link>
      </motion.div>
    </motion.div>
  );
}
