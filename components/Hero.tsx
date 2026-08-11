import Image from "next/image";
import CountdownTimer from "./CountdownTimer";
import { FEST_START } from "@/lib/data";

export default function Hero() {
  return (
    <section
      id="top"
      className="scanlines relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-void px-5 pt-24 pb-16"
    >
      {/* backdrop layers */}
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <Skyline />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-void via-void/80 to-transparent" />

      <p className="font-mono-fx relative z-10 text-[10px] uppercase tracking-[0.45em] text-fog-dim sm:text-xs">
        Kristu Jayanti Institute of Technology
      </p>
      <p className="font-mono-fx flicker relative z-10 mb-6 mt-2 text-[11px] uppercase tracking-[0.5em] text-cyan text-glow-cyan">
        Presents
      </p>

      <div className="relative z-10 h-24 w-full max-w-md sm:h-32 sm:max-w-xl md:h-40 md:max-w-2xl">
        <Image src="/logo.png" alt="MANŒUVRE — 未来をハックする" fill sizes="(min-width: 768px) 672px, 512px" className="object-contain" priority />
      </div>

      <p className="relative z-10 mt-4 font-mono-fx text-[11px] uppercase tracking-[0.4em] text-fog-dim">
        21st Edition
      </p>

      <p className="relative z-10 mt-3 font-mono-fx text-sm tracking-[0.3em] text-fog-dim">
        HACK THE FUTURE
      </p>

      <div className="text-vignette relative z-10 mt-8 max-w-xl px-4 py-2">
        <p className="text-center font-body text-sm leading-relaxed text-fog sm:text-base">
          Eight factions. Ten wars fought in code, wit, and nerve. One week to
          prove your faction runs this city. MANŒUVRE 2026 is Kristu Jayanti
          Institute of Technology&apos;s flagship fest — a week-long
          cyberpunk-themed gauntlet of quizzing, hacking, gaming, and
          gathering intel across the grid, ending in a single finale night
          where the leaderboard freezes for good.
        </p>
      </div>

      <div className="relative z-10 mt-9 flex flex-col items-center gap-2 font-mono-fx text-xs uppercase tracking-[0.3em] text-fog-dim">
        <span className="text-fog">17 — 24 August 2026</span>
        <span className="text-yellow text-glow-yellow">Finale · 24 August</span>
      </div>

      <div className="relative z-10 mt-10">
        <CountdownTimer target={FEST_START} label="System boots in" />
      </div>

      <div className="relative z-10 mt-10 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#events"
          className="border border-yellow/70 bg-yellow px-7 py-2.5 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-105"
        >
          View Events
        </a>
        <a
          href="#factions"
          className="border border-fog-dim/50 px-7 py-2.5 font-mono-fx text-xs uppercase tracking-widest text-fog transition-colors hover:border-cyan hover:text-cyan"
        >
          Meet the Factions
        </a>
      </div>
    </section>
  );
}

function Skyline() {
  const buildings = [
    { x: 0, w: 60, h: 140 },
    { x: 55, w: 40, h: 220 },
    { x: 90, w: 70, h: 100 },
    { x: 155, w: 50, h: 260 },
    { x: 200, w: 90, h: 160 },
    { x: 285, w: 45, h: 300 },
    { x: 325, w: 60, h: 190 },
    { x: 380, w: 80, h: 240 },
    { x: 455, w: 50, h: 130 },
    { x: 500, w: 65, h: 280 },
    { x: 560, w: 40, h: 170 },
    { x: 595, w: 90, h: 220 },
    { x: 680, w: 55, h: 150 },
    { x: 730, w: 70, h: 260 },
    { x: 795, w: 45, h: 190 },
    { x: 835, w: 65, h: 130 },
  ];

  const windows = buildings.flatMap((b, bi) =>
    Array.from({ length: Math.floor(b.h / 22) }).map((_, wi) => {
      const lit = (bi * 7 + wi * 3) % 5 === 0;
      return lit
        ? {
            x: b.x + 8 + ((wi * 13) % (b.w - 16)),
            y: 320 - b.h + 12 + wi * 22,
            key: `${bi}-${wi}`,
          }
        : null;
    }).filter(Boolean)
  ) as { x: number; y: number; key: string }[];

  return (
    <div className="animate-drift pointer-events-none absolute inset-x-0 bottom-0 h-[45%] w-[110%] opacity-50 mix-blend-screen">
      <svg
        viewBox="0 0 900 320"
        preserveAspectRatio="xMidYMax slice"
        className="h-full w-full"
      >
        {buildings.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={320 - b.h}
            width={b.w}
            height={b.h}
            fill={i % 3 === 0 ? "#ff2b8f" : i % 3 === 1 ? "#3ee9e6" : "#7b2fff"}
            opacity={0.45}
          />
        ))}
        {windows.map((w) => (
          <rect key={w.key} x={w.x} y={w.y} width={4} height={7} fill="#f4e04d" opacity={0.85} />
        ))}
      </svg>
    </div>
  );
}
