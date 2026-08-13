"use client";

import { useActionState, useRef } from "react";
import { uploadPhoto, removePhoto, notifyDocumentationTeam } from "@/app/dashboard/media/actions";

interface Photo {
  id: string;
  photoType: "geotagged" | "normal";
  url: string;
  name: string;
}

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
        <UploadField eventSlug={eventSlug} photoType="geotagged" label="Geotagged Photos" />
        <UploadField eventSlug={eventSlug} photoType="normal" label="Normal Photos" />
      </div>

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative border border-panel-line">
              <img src={p.url} alt={p.name} className="aspect-square w-full object-cover" />
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

function UploadField({ eventSlug, photoType, label }: { eventSlug: string; photoType: "geotagged" | "normal"; label: string }) {
  const [state, formAction, pending] = useActionState(uploadPhoto, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        formAction(fd);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <input type="hidden" name="photoType" value={photoType} />
      <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">{label}</span>
      <input
        type="file"
        name="file"
        accept="image/*"
        required
        disabled={pending}
        className="border border-panel-line bg-void px-2 py-2 font-mono-fx text-xs text-fog file:mr-3 file:border-0 file:bg-cyan file:px-2 file:py-1 file:font-mono-fx file:text-[10px] file:uppercase file:text-void disabled:opacity-40"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start border border-cyan/60 px-3 py-1.5 font-mono-fx text-[10px] uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-40"
      >
        {pending ? "Uploading..." : "Upload"}
      </button>
      {state.error && (
        <p className="font-mono-fx text-[10px] uppercase tracking-wide text-magenta text-glow-magenta">⚠ {state.error}</p>
      )}
    </form>
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
  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string | null }) => notifyDocumentationTeam(eventSlug),
    { error: null }
  );

  return (
    <form action={formAction} className="mt-4">
      <button
        type="submit"
        disabled={disabled || pending}
        className="border border-yellow/70 bg-yellow px-4 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-40"
      >
        {pending ? "Notifying..." : alreadyNotified ? "Notify Documentation Again" : "Notify Documentation Team"}
      </button>
      {state.error && (
        <p className="mt-2 font-mono-fx text-[10px] uppercase tracking-wide text-magenta text-glow-magenta">⚠ {state.error}</p>
      )}
    </form>
  );
}
