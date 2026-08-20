"use client";

import { useCallback, useRef, useState } from "react";
import { createUploadTargets, confirmUploads, removePhoto, notifyDocumentationTeam } from "@/app/dashboard/media/actions";
import { createBrowserClient } from "@/lib/supabase/browser";

interface Photo {
  id: string;
  photoType: "geotagged" | "normal";
  url: string;
  name: string;
}

type FileStatus = "queued" | "uploading" | "done" | "failed";
interface QueueItem {
  file: File;
  status: FileStatus;
}

const CONCURRENCY = 6;
const MAX_RETRIES = 2;

export default function PhotoUploadForm({
  eventSlug,
  eventName,
  photos,
  documentationNotified,
}: {
  eventSlug: string;
  eventName: string;
  photos: Photo[];
  documentationNotified: boolean;
}) {
  return (
    <div className="border border-panel-line bg-panel/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold uppercase text-fog">{eventName}</h3>
        <span className="font-mono-fx text-xs text-fog-dim">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UploadZone eventSlug={eventSlug} photoType="geotagged" label="Geotagged Photos" hint="Internal only — never shown on the public event page." />
        <UploadZone eventSlug={eventSlug} photoType="normal" label="Normal Photos" hint="These show up in the public gallery on the event page." />
      </div>

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative border border-panel-line">
              <img src={p.url} alt={p.name} loading="lazy" className="aspect-square w-full object-cover" />
              <span className="absolute left-1 top-1 bg-void/80 px-1.5 py-0.5 font-mono-fx text-[9px] uppercase text-cyan">
                {p.photoType}
              </span>
              <RemoveButton photoId={p.id} />
            </div>
          ))}
        </div>
      )}

      <NotifyButton eventSlug={eventSlug} disabled={photos.length === 0} alreadyNotified={documentationNotified} />
    </div>
  );
}

function UploadZone({
  eventSlug,
  photoType,
  label,
  hint,
}: {
  eventSlug: string;
  photoType: "geotagged" | "normal";
  label: string;
  hint: string;
}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const done = queue.filter((q) => q.status === "done").length;
  const failed = queue.filter((q) => q.status === "failed").length;
  const total = queue.length;

  const setStatus = (index: number, status: FileStatus) =>
    setQueue((prev) => prev.map((q, i) => (i === index ? { ...q, status } : q)));

  const runUpload = useCallback(
    async (files: File[]) => {
      setError(null);
      setBusy(true);
      const items: QueueItem[] = files.map((file) => ({ file, status: "queued" as const }));
      setQueue(items);

      const browser = createBrowserClient();
      const successfulPaths: string[] = [];

      // Chunk target-creation too, so a 400-file batch doesn't sit in one
      // giant server round trip -- each chunk is just URL generation, no
      // bytes, so it's fast, but chunking keeps progress visibly moving.
      const CHUNK = 40;
      for (let chunkStart = 0; chunkStart < files.length; chunkStart += CHUNK) {
        const chunkFiles = files.slice(chunkStart, chunkStart + CHUNK);
        const { targets, error: targetError } = await createUploadTargets(
          eventSlug,
          photoType,
          chunkFiles.map((f) => ({ name: f.name, type: f.type, size: f.size }))
        );
        if (targetError && targets.length === 0) {
          for (let i = chunkStart; i < chunkStart + chunkFiles.length; i++) setStatus(i, "failed");
          setError(targetError);
          continue;
        }

        const targetByName = new Map(targets.map((t) => [t.name, t]));
        let cursor = 0;
        const worker = async () => {
          while (cursor < chunkFiles.length) {
            const localIndex = cursor++;
            const globalIndex = chunkStart + localIndex;
            const file = chunkFiles[localIndex];
            const target = targetByName.get(file.name);
            if (!target) {
              setStatus(globalIndex, "failed");
              continue;
            }
            setStatus(globalIndex, "uploading");

            let ok = false;
            for (let attempt = 0; attempt <= MAX_RETRIES && !ok; attempt++) {
              const { error: uploadError } = await browser.storage
                .from("event-photos")
                .uploadToSignedUrl(target.path, target.token, file);
              ok = !uploadError;
            }

            if (ok) {
              successfulPaths.push(target.path);
              setStatus(globalIndex, "done");
            } else {
              setStatus(globalIndex, "failed");
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunkFiles.length) }, worker));
      }

      if (successfulPaths.length > 0) {
        const { error: confirmError } = await confirmUploads(eventSlug, photoType, successfulPaths);
        if (confirmError) setError(confirmError);
      }
      setBusy(false);
    },
    [eventSlug, photoType]
  );

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    void runUpload(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col gap-2 border border-dashed p-3 transition-colors ${
        dragOver ? "border-cyan bg-cyan/5" : "border-panel-line"
      }`}
    >
      <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">{label}</span>
      <p className="font-body text-[11px] text-fog-dim">{hint}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={busy}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="self-start border border-cyan/60 px-3 py-1.5 font-mono-fx text-[10px] uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-40"
      >
        {busy ? "Uploading..." : "Choose Files or Drag Here"}
      </button>

      {total > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden bg-void">
            <div
              className={`h-full transition-all ${failed > 0 ? "bg-magenta" : "bg-cyan"}`}
              style={{ width: `${((done + failed) / total) * 100}%` }}
            />
          </div>
          <span className="font-mono-fx text-[9px] uppercase tracking-widest text-fog-dim">
            {done} / {total} uploaded{failed > 0 ? ` · ${failed} failed` : ""}
          </span>
        </div>
      )}

      {error && (
        <p className="font-mono-fx text-[10px] uppercase tracking-wide text-magenta text-glow-magenta">⚠ {error}</p>
      )}
    </div>
  );
}

function RemoveButton({ photoId }: { photoId: string }) {
  return (
    <button
      onClick={() => removePhoto(photoId)}
      className="absolute right-1 top-1 hidden bg-void/80 px-1.5 py-0.5 font-mono-fx text-[9px] uppercase text-magenta group-hover:block"
    >
      ✕
    </button>
  );
}

function NotifyButton({ eventSlug, disabled, alreadyNotified }: { eventSlug: string; disabled: boolean; alreadyNotified: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={async () => {
          setPending(true);
          const res = await notifyDocumentationTeam(eventSlug);
          setError(res.error);
          setPending(false);
        }}
        className="border border-yellow/70 bg-yellow px-4 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-40"
      >
        {pending ? "Notifying..." : alreadyNotified ? "Notify Documentation Again" : "Notify Documentation Team"}
      </button>
      {error && (
        <p className="mt-2 font-mono-fx text-[10px] uppercase tracking-wide text-magenta text-glow-magenta">⚠ {error}</p>
      )}
    </div>
  );
}
