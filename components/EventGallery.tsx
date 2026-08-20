"use client";

import { useEffect, useState } from "react";

interface GalleryPhoto {
  id: string;
  url: string;
}

export default function EventGallery({ photos, borderClass }: { photos: GalleryPhoto[]; borderClass: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, photos.length]);

  if (photos.length === 0) return null;

  return (
    <div className={`mt-8 border ${borderClass} bg-panel/50 p-6`}>
      <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">// Gallery</p>
      <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setOpenIndex(i)}
            className="group relative aspect-square w-36 flex-shrink-0 snap-start overflow-hidden border border-panel-line sm:w-44"
          >
            <img
              src={p.url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/95 p-4"
        >
          <button
            onClick={() => setOpenIndex(null)}
            aria-label="Close"
            className="absolute right-5 top-5 font-mono-fx text-2xl text-fog-dim transition-colors hover:text-magenta"
          >
            ✕
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
            }}
            aria-label="Previous"
            className="absolute left-2 top-1/2 -translate-y-1/2 px-3 py-6 font-mono-fx text-2xl text-fog-dim transition-colors hover:text-cyan sm:left-6"
          >
            ‹
          </button>
          <img
            src={photos[openIndex].url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] border border-panel-line object-contain"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length));
            }}
            aria-label="Next"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-6 font-mono-fx text-2xl text-fog-dim transition-colors hover:text-cyan sm:right-6"
          >
            ›
          </button>
          <span className="absolute bottom-6 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
            {openIndex + 1} / {photos.length}
          </span>
        </div>
      )}
    </div>
  );
}
