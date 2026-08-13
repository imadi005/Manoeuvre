"use client";

import { useActionState, useState, useTransition } from "react";
import { saveEventReport, submitReportForApproval } from "@/app/dashboard/documentation/actions";

interface ExistingReport {
  summary: string | null;
  objectives: string | null;
  outcome: string | null;
  feedback: string | null;
  web_url: string | null;
  highlights: string | null;
  issues: string | null;
  status: string;
  rejection_reason: string | null;
  updated_at: string;
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  draft: { text: "Draft", className: "text-fog-dim" },
  submitted: { text: "Awaiting Faculty Approval", className: "text-yellow" },
  approved: { text: "Approved", className: "text-cyan" },
  rejected: { text: "Sent Back — Resubmit", className: "text-magenta" },
};

export default function DocumentationReportForm({
  eventSlug,
  eventName,
  existing,
  scheduleBlocks,
  participants,
  posterUrl,
  photos,
}: {
  eventSlug: string;
  eventName: string;
  existing: ExistingReport | null;
  scheduleBlocks: { date: string; time: string; venue?: string }[];
  participants: { name: string; rollNumber: string }[];
  posterUrl: string;
  photos: { url: string; photoType: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveEventReport, { error: null });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const status = existing?.status ?? "draft";
  const locked = status === "submitted" || status === "approved";
  const geotagged = photos.filter((p) => p.photoType === "geotagged");
  const normal = photos.filter((p) => p.photoType === "normal");

  function handleSubmitForApproval() {
    setSubmitError(null);
    startSubmit(async () => {
      const result = await submitReportForApproval(eventSlug);
      if (result.error) setSubmitError(result.error);
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-panel-line pt-4">
      <div className="flex items-center justify-between">
        <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">// Full Report — {eventName}</p>
        <span className={`font-mono-fx text-[10px] uppercase tracking-widest ${STATUS_LABEL[status].className}`}>
          {STATUS_LABEL[status].text}
        </span>
      </div>

      {existing?.rejection_reason && status !== "submitted" && (
        <p className="border border-magenta/40 bg-magenta/10 px-3 py-2 font-body text-sm text-magenta">
          Sent back: &ldquo;{existing.rejection_reason}&rdquo;
        </p>
      )}

      {/* Auto-filled, read-only section */}
      <div className="border border-panel-line/60 bg-void p-3">
        <p className="font-mono-fx text-[10px] uppercase tracking-widest text-cyan">Schedule</p>
        {scheduleBlocks.length === 0 ? (
          <p className="mt-1 font-body text-xs text-fog-dim">No locked schedule slot found.</p>
        ) : (
          scheduleBlocks.map((b, i) => (
            <p key={i} className="mt-1 font-body text-xs text-fog">
              {b.date} · {b.time} {b.venue ? `· ${b.venue}` : ""}
            </p>
          ))
        )}
        <p className="mt-3 font-mono-fx text-[10px] uppercase tracking-widest text-cyan">
          Participants ({participants.length})
        </p>
        <div className="mt-1 max-h-32 overflow-y-auto">
          {participants.map((p) => (
            <p key={p.rollNumber} className="font-mono-fx text-[11px] text-fog-dim">
              {p.rollNumber} — {p.name}
            </p>
          ))}
        </div>
        <p className="mt-3 font-mono-fx text-[10px] uppercase tracking-widest text-cyan">Poster / Brochure</p>
        <img src={posterUrl} alt={`${eventName} poster`} className="mt-1 h-24 w-auto border border-panel-line/60" />
        <p className="mt-3 font-mono-fx text-[10px] uppercase tracking-widest text-cyan">
          Geotagged Photos ({geotagged.length}) &amp; Normal Photos ({normal.length})
        </p>
        {photos.length === 0 ? (
          <p className="mt-1 font-body text-xs text-fog-dim">
            None uploaded yet — waiting on the media team.
          </p>
        ) : (
          <div className="mt-1 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {photos.map((p, i) => (
              <img key={i} src={p.url} alt="" className="aspect-square w-full border border-panel-line/60 object-cover" />
            ))}
          </div>
        )}
      </div>

      {locked ? (
        <p className="font-body text-sm text-fog-dim">
          {status === "approved"
            ? "Approved and locked."
            : "Submitted and awaiting faculty approval — can't be edited right now."}
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="eventSlug" value={eventSlug} />

          <label className="flex flex-col gap-1.5">
            <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Objectives</span>
            <textarea
              name="objectives"
              defaultValue={existing?.objectives ?? ""}
              rows={2}
              placeholder="1. ...&#10;2. ..."
              className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Write-Up</span>
            <textarea
              name="summary"
              defaultValue={existing?.summary ?? ""}
              rows={4}
              placeholder="What happened, how it ran, turnout..."
              className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Outcome</span>
            <textarea
              name="outcome"
              defaultValue={existing?.outcome ?? ""}
              rows={2}
              className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Web URL (optional)</span>
            <input
              name="webUrl"
              type="url"
              defaultValue={existing?.web_url ?? ""}
              placeholder="https://instagram.com/..."
              className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Feedback</span>
            <textarea
              name="feedback"
              defaultValue={existing?.feedback ?? ""}
              rows={2}
              className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Highlights (optional)</span>
            <textarea
              name="highlights"
              defaultValue={existing?.highlights ?? ""}
              rows={2}
              className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Issues / Notes (optional)</span>
            <textarea
              name="issues"
              defaultValue={existing?.issues ?? ""}
              rows={2}
              className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
            />
          </label>

          {state.error && (
            <p className="font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">⚠ {state.error}</p>
          )}
          {submitError && (
            <p className="font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">⚠ {submitError}</p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="border border-cyan/70 bg-cyan px-5 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={handleSubmitForApproval}
              disabled={isSubmitting}
              className="border border-yellow/70 bg-yellow px-5 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit for Approval"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
