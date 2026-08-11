"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { events, posterFor } from "@/lib/data";
import { useIsMobile } from "@/lib/useIsMobile";

interface Pin {
  x: number;
  y: number;
  rotate: number;
}

// Wide scatter for desktop — 5 columns x 2 rows.
const LAYOUT_DESKTOP: Pin[] = [
  { x: 8, y: 22, rotate: -6 },
  { x: 32, y: 29, rotate: 5 },
  { x: 47, y: 27, rotate: -4 },
  { x: 73, y: 22, rotate: 6 },
  { x: 88, y: 28, rotate: -5 },
  { x: 13, y: 73, rotate: 4 },
  { x: 27, y: 78, rotate: -6 },
  { x: 52, y: 71, rotate: 5 },
  { x: 68, y: 77, rotate: -3 },
  { x: 93, y: 72, rotate: 6 },
];

// Narrow scatter for mobile — 2 columns x 5 rows, same board mechanic.
const LAYOUT_MOBILE: Pin[] = [
  { x: 24, y: 11, rotate: -6 },
  { x: 76, y: 9, rotate: 5 },
  { x: 28, y: 31, rotate: 4 },
  { x: 72, y: 29, rotate: -5 },
  { x: 25, y: 51, rotate: 6 },
  { x: 75, y: 49, rotate: -4 },
  { x: 29, y: 71, rotate: -6 },
  { x: 73, y: 69, rotate: 5 },
  { x: 26, y: 91, rotate: 4 },
  { x: 74, y: 89, rotate: -6 },
];

export default function EvidenceBoard() {
  const isMobile = useIsMobile();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Avoid a layout flash before we know the viewport — render nothing briefly.
  if (isMobile === null) {
    return <div className="h-[400px] w-full sm:h-[720px]" />;
  }

  const layout = isMobile ? LAYOUT_MOBILE : LAYOUT_DESKTOP;
  const posterWidth = isMobile ? 42 : 15;

  return (
    <div>
      <div className={`relative w-full ${isMobile ? "h-[1500px]" : "h-[720px]"}`}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <defs>
            <filter id="evidence-thread-glow" x="-300%" y="-300%" width="700%" height="700%">
              <feGaussianBlur stdDeviation="1.1" />
            </filter>
            <path
              id="evidence-thread-path"
              d={`M ${layout.map((p) => `${p.x},${p.y}`).join(" L ")}`}
              fill="none"
            />
          </defs>

          <polyline
            points={layout.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#ff2b8f"
            strokeWidth="0.6"
            strokeOpacity="0.15"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={layout.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#ff2b8f"
            strokeWidth="0.15"
            strokeOpacity="0.6"
            vectorEffect="non-scaling-stroke"
          />

          {/* A single glowing spark traveling the full length of the thread, on a loop. */}
          <g>
            <circle r="2" fill="#8b0000" opacity="0.7" filter="url(#evidence-thread-glow)" />
            <circle r="0.55" fill="#ff3b3b" />
            <animateMotion dur="14s" repeatCount="indefinite" rotate="auto">
              <mpath href="#evidence-thread-path" />
            </animateMotion>
          </g>
        </svg>

        {events.map((event, i) => {
          const pos = layout[i];
          return (
            <motion.button
              key={event.slug}
              onClick={() => setOpenIndex(i)}
              initial={{ rotate: pos.rotate }}
              whileHover={{ rotate: 0, scale: 1.12, zIndex: 20 }}
              whileTap={{ rotate: 0, scale: 1.08, zIndex: 20 }}
              transition={{ duration: 0.2 }}
              className="group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${posterWidth}%` }}
            >
              <span className="absolute -top-1.5 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-magenta shadow-[0_0_8px_2px_rgba(255,43,143,0.7)]" />
              <div className="relative aspect-[1/1.414] overflow-hidden border-2 border-panel-line bg-void shadow-xl transition-colors group-hover:border-magenta">
                <Image
                  src={posterFor(event.slug)}
                  alt={`${event.name} poster`}
                  fill
                  sizes={isMobile ? "45vw" : "15vw"}
                  className="object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-void/30 transition-opacity group-hover:opacity-0" />
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {openIndex !== null && (
          <Lightbox index={openIndex} onClose={() => setOpenIndex(null)} onChange={setOpenIndex} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Lightbox({
  index,
  onClose,
  onChange,
}: {
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
}) {
  const event = events[index];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-void/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 font-mono-fx text-sm uppercase tracking-widest text-fog-dim hover:text-fog"
      >
        ✕ Close
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onChange((index - 1 + events.length) % events.length);
        }}
        aria-label="Previous poster"
        className="absolute left-2 z-10 rounded-full border border-panel-line bg-void-deep/80 p-3 text-fog-dim hover:text-fog sm:left-6"
      >
        ‹
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onChange((index + 1) % events.length);
        }}
        aria-label="Next poster"
        className="absolute right-2 z-10 rounded-full border border-panel-line bg-void-deep/80 p-3 text-fog-dim hover:text-fog sm:right-6"
      >
        ›
      </button>

      <motion.div
        key={event.slug}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="mx-4 flex max-h-[85vh] w-full max-w-sm flex-col items-center"
      >
        <div className="relative aspect-[1/1.414] w-full box-glow-magenta">
          <Image
            src={posterFor(event.slug)}
            alt={`${event.name} poster`}
            fill
            sizes="384px"
            className="object-contain"
            priority
          />
        </div>
        <Link
          href={`/events/${event.slug}`}
          className="mt-5 border border-yellow/70 bg-yellow px-6 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-105"
        >
          View Event Details →
        </Link>
      </motion.div>
    </motion.div>
  );
}
