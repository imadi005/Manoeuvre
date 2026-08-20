"use client";

import { useEffect, useState } from "react";

interface GalleryPhoto {
  id: string;
  url: string;
  name: string;
}

/** Forces a real download even though the file lives on a different origin
 * (Supabase Storage) -- a plain `<a download>` to a cross-origin URL just
 * navigates instead of saving in most browsers, so fetch the bytes first. */
async function downloadPhoto(url: string, name: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 14.5v1a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function EventGallery({ photos, borderClass }: { photos: GalleryPhoto[]; borderClass: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

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
      <div className="flex items-baseline justify-between">
        <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">// Gallery</p>
        <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Click a photo to view &amp; download</p>
      </div>
      <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {photos.map((p, i) => (
          <div key={p.id} className="group relative aspect-square w-36 flex-shrink-0 snap-start sm:w-44">
            <button
              onClick={() => setOpenIndex(i)}
              className="block h-full w-full cursor-pointer overflow-hidden border border-panel-line"
              aria-label="Open photo"
            >
              <img
                src={p.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void downloadPhoto(p.url, p.name);
              }}
              aria-label="Download photo"
              title="Download"
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center border border-panel-line bg-void/80 text-fog opacity-0 backdrop-blur-sm transition-opacity hover:border-cyan hover:text-cyan group-hover:opacity-100"
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
          </div>
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
          <div className="absolute bottom-6 flex flex-col items-center gap-3">
            <button
              onClick={async (e) => {
                e.stopPropagation();
                setDownloading(true);
                await downloadPhoto(photos[openIndex].url, photos[openIndex].name);
                setDownloading(false);
              }}
              disabled={downloading}
              className="flex items-center gap-2 border border-cyan/60 bg-void/80 px-4 py-2 font-mono-fx text-[11px] uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-50"
            >
              <DownloadIcon className="h-4 w-4" />
              {downloading ? "Downloading..." : "Download"}
            </button>
            <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
              {openIndex + 1} / {photos.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
