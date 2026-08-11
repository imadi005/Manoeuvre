"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function FactionHeroArt({
  logo,
  name,
  accent,
}: {
  logo: string;
  name: string;
  accent: string;
}) {
  return (
    <div
      style={{ "--accent": accent } as React.CSSProperties}
      className="relative mx-auto w-full max-w-sm"
    >
      <div className="bg-glow-accent pointer-events-none absolute -inset-10" />
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative aspect-square"
      >
        <Image
          src={logo}
          alt={`${name} emblem`}
          fill
          sizes="(max-width: 640px) 90vw, 384px"
          priority
          className="object-contain"
        />
      </motion.div>
    </div>
  );
}
