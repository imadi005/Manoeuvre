"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  previewUrl: string;
  status: FileStatus;
}

const CONCURRENCY = 6;
const MAX_RETRIES = 2;
const CHUNK = 40;

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
  const geoCount = photos.filter((p) => p.photoType === "geotagged").length;
  const normalCount = photos.filter((p) => p.photoType === "normal").length;

  return (
    <div className="border border-panel-line bg-panel/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold uppercase text-fog">{eventName}</h3>
        <span className="font-mono-fx text-xs text-fog-dim">
          {normalCount} normal · {geoCount} geotagged
        </span>
      </div>

      <div className="mt-4">
        <Uploader eventSlug={eventSlug} />
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

function Uploader({ eventSlug }: { eventSlug: string }) {
  const [photoType, setPhotoType] = useState<"normal" | "geotagged">("normal");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const done = queue.filter((q) => q.status === "done").length;
  const failed = queue.filter((q) => q.status === "failed").length;
  const total = queue.length;
  const settled = done + failed;

  const setStatus = (index: number, status: FileStatus) =>
    setQueue((prev) => prev.map((q, i) => (i === index ? { ...q, status } : q)));

  useEffect(() => {
    // Revoke object URLs once the batch finishes, so we don't leak memory
    // across repeated upload runs.
    if (total > 0 && settled === total) {
      const urls = queue.map((q) => q.previewUrl);
      return () => urls.forEach((u) => URL.revokeObjectURL(u));
    }
  }, [total, settled, queue]);

  const runUpload = useCallback(
    async (files: File[], type: "normal" | "geotagged") => {
      setError(null);
      setBusy(true);
      const items: QueueItem[] = files.map((file) => ({ file, previewUrl: URL.createObjectURL(file), status: "queued" as const }));
      setQueue(items);

      const browser = createBrowserClient();
      const successfulPaths: string[] = [];

      for (let chunkStart = 0; chunkStart < files.length; chunkStart += CHUNK) {
        const chunkFiles = files.slice(chunkStart, chunkStart + CHUNK);
        const { targets, error: targetError } = await createUploadTargets(
          eventSlug,
          type,
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
        const { error: confirmError } = await confirmUploads(eventSlug, type, successfulPaths);
        if (confirmError) setError(confirmError);
      }
      setBusy(false);
    },
    [eventSlug]
  );

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    void runUpload(Array.from(fileList), photoType);
  };

  const retryFailed = () => {
    const failedFiles = queue.filter((q) => q.status === "failed").map((q) => q.file);
    if (failedFiles.length > 0) void runUpload(failedFiles, photoType);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Uploading as:</span>
        <div className="flex overflow-hidden border border-panel-line">
          {(["normal", "geotagged"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={busy}
              onClick={() => setPhotoType(t)}
              className={`px-3 py-1.5 font-mono-fx text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40 ${
                photoType === t ? "bg-cyan text-void" : "text-fog-dim hover:text-fog"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <p className="font-body text-[11px] text-fog-dim">
        {photoType === "normal"
          ? "Goes in the public gallery on the event page."
          : "Internal only — never shown on the public event page."}
      </p>

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
        className={`flex flex-col items-center gap-2 border border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-cyan bg-cyan/5" : "border-panel-line"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <p className="font-mono-fx text-[11px] uppercase tracking-widest text-fog-dim">
          Drag photos here, or
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="border border-cyan/60 px-4 py-2 font-mono-fx text-[11px] uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-40"
        >
          {busy ? "Uploading..." : "Choose Files"}
        </button>
        <p className="font-mono-fx text-[9px] uppercase tracking-widest text-fog-dim">Any number at once — up to 15MB each</p>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-2">
          <div className="h-1.5 w-full overflow-hidden bg-void">
            <div
              className={`h-full transition-all ${failed > 0 ? "bg-magenta" : "bg-cyan"}`}
              style={{ width: `${(settled / total) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
              {done} / {total} uploaded{failed > 0 ? ` · ${failed} failed` : ""}
              {busy ? " · in progress" : settled === total ? " · done" : ""}
            </span>
            {!busy && failed > 0 && (
              <button
                type="button"
                onClick={retryFailed}
                className="font-mono-fx text-[10px] uppercase tracking-widest text-yellow hover:underline"
              >
                Retry {failed} failed
              </button>
            )}
          </div>

          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {queue.map((q, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden border border-panel-line">
                <img src={q.previewUrl} alt="" className="h-full w-full object-cover" />
                <StatusBadge status={q.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="font-mono-fx text-[10px] uppercase tracking-wide text-magenta text-glow-magenta">⚠ {error}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: FileStatus }) {
  if (status === "queued") {
    return <div className="absolute inset-0 flex items-center justify-center bg-void/60 font-mono-fx text-[8px] uppercase text-fog-dim">···</div>;
  }
  if (status === "uploading") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-void/50">
        <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-cyan border-t-transparent" />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-magenta/30 font-mono-fx text-[10px] text-magenta">✕</div>
    );
  }
  return (
    <div className="absolute bottom-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan font-mono-fx text-[8px] text-void">
      ✓
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
