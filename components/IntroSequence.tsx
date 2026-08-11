"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

const BOOT_LINES = [
  "> ESTABLISHING UPLINK...",
  "> AUTH SOURCE: KRISTU JAYANTI INSTITUTE OF TECHNOLOGY",
  "> CLEARANCE VERIFIED",
  "> LOADING PROTOCOL — MANŒUVRE_2026.exe",
];

const SESSION_KEY = "manoeuvre-intro-seen";

export default function IntroSequence() {
  const [visible, setVisible] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [showLogo, setShowLogo] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (lineIndex >= BOOT_LINES.length) {
      const t = setTimeout(() => setShowLogo(true), 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLineIndex((i) => i + 1), 420);
    return () => clearTimeout(t);
  }, [visible, lineIndex]);

  useEffect(() => {
    if (!showLogo) return;
    const t = setTimeout(() => finish(), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLogo]);

  function finish() {
    setExiting(true);
    sessionStorage.setItem(SESSION_KEY, "1");
    setTimeout(() => setVisible(false), 700);
  }

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="scanlines grain fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-void"
          initial={{ opacity: 1 }}
          animate={{ opacity: exiting ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />

          {!showLogo && (
            <div className="relative z-10 w-full max-w-md px-6 font-mono-fx text-xs text-cyan sm:text-sm">
              {BOOT_LINES.slice(0, lineIndex).map((line, i) => (
                <p key={i} className="mb-2 opacity-80">
                  {line}
                </p>
              ))}
              {lineIndex < BOOT_LINES.length && (
                <p className="text-fog">
                  {BOOT_LINES[lineIndex]?.slice(
                    0,
                    Math.max(0, lineIndex + 1)
                  )}
                  <span className="caret">▍</span>
                </p>
              )}
            </div>
          )}

          <AnimatePresence>
            {showLogo && (
              <motion.div
                className="relative z-10 flex flex-col items-center px-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.3 }}
                  className="font-mono-fx text-[10px] uppercase tracking-[0.5em] text-fog-dim sm:text-xs"
                >
                  Kristu Jayanti Institute of Technology
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  className="mt-2 font-display text-sm uppercase tracking-[0.4em] text-magenta text-glow-magenta sm:text-base"
                >
                  KJIT Presents
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                  className="relative mt-4 h-20 w-72 sm:h-28 sm:w-96"
                >
                  <Image src="/logo.png" alt="MANŒUVRE" fill sizes="384px" className="object-contain" priority />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={finish}
            className="absolute bottom-6 right-6 z-10 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim transition-colors hover:text-cyan sm:bottom-8 sm:right-8"
          >
            Skip [ESC]
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
