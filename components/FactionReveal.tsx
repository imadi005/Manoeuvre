"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { factions, type Faction } from "@/lib/data";

type Phase = "shuffle" | "converge" | "flash" | "card";

const SLOT_COUNT = factions.length;
const SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => {
  const angle = (i / SLOT_COUNT) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(angle) * 32, y: 50 + Math.sin(angle) * 32 };
});

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FactionReveal({
  faction,
  studentName,
}: {
  faction: Faction;
  studentName: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("shuffle");
  const [order, setOrder] = useState<string[]>(() => factions.map((f) => f.slug));

  useEffect(() => {
    // Shuffle ticks land closer together at first, then spread out — a wheel
    // spinning fast and settling to a stop, not a flat metronome.
    const shuffleTimes = [0, 240, 500, 780, 1080, 1420, 1800];
    const timers = shuffleTimes.map((t) =>
      setTimeout(() => {
        setOrder(shuffled(factions.map((f) => f.slug)));
      }, t)
    );
    const tConverge = setTimeout(() => setPhase("converge"), 2150);
    const tFlash = setTimeout(() => setPhase("flash"), 2850);
    const tCard = setTimeout(() => setPhase("card"), 3300);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(tConverge);
      clearTimeout(tFlash);
      clearTimeout(tCard);
    };
  }, []);

  const showCard = phase === "card";
  const converging = phase === "converge" || phase === "flash" || phase === "card";

  return (
    <div
      className="scanlines grain fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-void"
      style={{ "--accent": faction.accent } as React.CSSProperties}
    >
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />

      <p className="absolute top-10 left-1/2 z-10 -translate-x-1/2 px-4 text-center font-mono-fx text-[10px] uppercase tracking-[0.4em] text-fog-dim sm:text-xs">
        {showCard
          ? "Faction Confirmed"
          : converging
            ? "Locking signal..."
            : `Scanning faction registry — Operative ${studentName}`}
      </p>

      {!showCard &&
        factions.map((f) => {
          const slotIndex = order.indexOf(f.slug);
          const pos = SLOTS[slotIndex] ?? { x: 50, y: 50 };
          const isMine = f.slug === faction.slug;

          return (
            <motion.div
              key={f.slug}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              animate={
                converging
                  ? { left: "50%", top: "50%", scale: isMine ? 1.15 : 0, opacity: isMine ? 1 : 0 }
                  : { left: `${pos.x}%`, top: `${pos.y}%`, scale: 1, opacity: 1, rotate: [0, -3, 3, 0] }
              }
              transition={
                converging
                  ? { duration: 0.6, ease: "easeInOut" }
                  : { left: { duration: 0.38, ease: "easeInOut" }, top: { duration: 0.38, ease: "easeInOut" }, rotate: { duration: 0.6, repeat: Infinity } }
              }
            >
              <div
                className="pointer-events-none absolute -inset-3 rounded-full opacity-60 blur-md"
                style={{ backgroundColor: f.accent }}
              />
              <div className="relative h-14 w-14 sm:h-20 sm:w-20">
                <Image src={f.logo} alt={f.name} fill sizes="80px" className="object-contain" />
              </div>
            </motion.div>
          );
        })}

      {/* Flash burst in the winning faction's color */}
      <AnimatePresence>
        {phase === "flash" && (
          <motion.div
            key="flash"
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(circle at 50% 50%, ${faction.accent} 0%, white 15%, transparent 65%)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.4, times: [0, 0.35, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Faction card reveal — each element lands in its own beat. */}
      <AnimatePresence>
        {showCard && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0, scale: 0.85 },
              show: {
                opacity: 1,
                scale: 1,
                transition: { duration: 0.4, ease: "easeOut", staggerChildren: 0.08, delayChildren: 0.08 },
              },
            }}
            className="hover-glow-accent relative z-10 flex w-full max-w-xs flex-col items-center border border-panel-line bg-panel/70 p-7 text-center backdrop-blur-sm"
          >
            {[
              <div key="site-logo" className="relative h-6 w-28">
                <Image src="/logo.png" alt="MANŒUVRE" fill sizes="112px" className="object-contain" />
              </div>,
              <div key="logo" className="relative mt-3 aspect-square w-full max-w-[200px]">
                <Image src={faction.logo} alt={`${faction.name} emblem`} fill sizes="200px" className="object-contain" priority />
              </div>,
              <p key="label" className="mt-4 font-mono-fx text-[10px] uppercase tracking-[0.4em] text-fog-dim">
                You are
              </p>,
              <h1 key="name" className="text-glow-accent font-display mt-1 text-2xl font-black uppercase sm:text-3xl">
                {faction.name}
              </h1>,
              <p key="tagline" className="mt-3 font-body text-sm italic text-fog">
                &ldquo;{faction.tagline}&rdquo;
              </p>,
              <p key="coords" className="mt-3 font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
                Coord. {faction.heads[0]} · Coord. {faction.heads[1]}
              </p>,
              <button
                key="cta"
                onClick={() => router.push("/dashboard/student")}
                className="mt-6 border px-7 py-2.5 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-105"
                style={{ backgroundColor: faction.accent, borderColor: faction.accent }}
              >
                Enter the Grid →
              </button>,
              <Link
                key="profile"
                href={`/factions/${faction.slug}`}
                className="mt-3 font-mono-fx text-[11px] uppercase tracking-widest text-fog-dim transition-colors hover:text-fog"
              >
                View full faction profile
              </Link>,
            ].map((child) => (
              <motion.div
                key={child.key}
                className="flex w-full flex-col items-center"
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } } }}
              >
                {child}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
