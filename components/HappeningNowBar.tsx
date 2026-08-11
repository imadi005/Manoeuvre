"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLiveBlock, type ScheduleBlock } from "@/lib/schedule";

export default function HappeningNowBar() {
  const [live, setLive] = useState<ScheduleBlock | null | undefined>(undefined);

  useEffect(() => {
    function check() {
      setLive(getLiveBlock());
    }
    check();
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, []);

  if (!live) return null;

  const content = (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 font-mono-fx text-[11px] uppercase tracking-widest text-void sm:text-xs">
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-void/70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-void" />
      </span>
      <span className="font-bold">Happening now</span>
      <span className="hidden sm:inline">—</span>
      <span className="truncate">{live.title}</span>
      {live.venue && <span className="hidden opacity-80 sm:inline">· {live.venue}</span>}
    </div>
  );

  return (
    <div className="bg-yellow">
      {live.eventSlug ? (
        <Link href={`/events/${live.eventSlug}`} className="block transition-opacity hover:opacity-90">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
