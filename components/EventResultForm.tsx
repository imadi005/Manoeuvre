"use client";

import { useActionState } from "react";
import { submitResult } from "@/app/dashboard/event-lead/actions";

interface Faction {
  id: string;
  name: string;
}

interface ExistingResult {
  status: "submitted" | "faculty_approved" | "faculty_rejected" | "control_verified" | "control_rejected" | "published";
  first_faction_id: string | null;
  second_faction_id: string | null;
  third_faction_id: string | null;
  fourth_faction_id: string | null;
  notes: string | null;
  rejection_reason: string | null;
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  submitted: { text: "Awaiting Faculty Approval", className: "text-yellow" },
  faculty_approved: { text: "Faculty-Approved — With Control Room", className: "text-cyan" },
  faculty_rejected: { text: "Sent Back by Faculty — Resubmit", className: "text-magenta" },
  control_verified: { text: "Cross-Checked — Awaiting Publish", className: "text-cyan" },
  control_rejected: { text: "Sent Back by Control Room — Resubmit", className: "text-magenta" },
  published: { text: "Published", className: "text-cyan" },
};

const LOCKED_STATUSES = new Set(["faculty_approved", "control_verified", "published"]);

export default function EventResultForm({
  factions,
  existing,
}: {
  factions: Faction[];
  existing: ExistingResult | null;
}) {
  const [state, formAction, pending] = useActionState(submitResult, { error: null });
  const locked = existing ? LOCKED_STATUSES.has(existing.status) : false;

  const fields: { name: "first" | "second" | "third" | "fourth"; label: string; value: string | null }[] = [
    { name: "first", label: "1st Place (40%)", value: existing?.first_faction_id ?? null },
    { name: "second", label: "2nd Place (30%)", value: existing?.second_faction_id ?? null },
    { name: "third", label: "3rd Place (20%)", value: existing?.third_faction_id ?? null },
    { name: "fourth", label: "4th Place (10%)", value: existing?.fourth_faction_id ?? null },
  ];

  return (
    <div className="border border-panel-line bg-panel/50 p-6">
      <div className="flex items-center justify-between">
        <p className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">// Submit Result</p>
        {existing && (
          <span className={`font-mono-fx text-xs uppercase tracking-widest ${STATUS_LABEL[existing.status].className}`}>
            {STATUS_LABEL[existing.status].text}
          </span>
        )}
      </div>

      {locked ? (
        <p className="mt-4 font-body text-sm text-fog">
          {existing?.status === "published"
            ? "Result published and locked. Contact the control room if this needs correcting."
            : "Result is with faculty/control room for review and can't be edited right now."}
        </p>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-4">
          {existing?.rejection_reason && (
            <p className="border border-magenta/40 bg-magenta/10 px-3 py-2 font-body text-sm text-magenta">
              Sent back: &ldquo;{existing.rejection_reason}&rdquo;
            </p>
          )}
          {fields.map((f) => (
            <label key={f.name} className="flex flex-col gap-1.5">
              <span className="font-mono-fx text-[11px] uppercase tracking-widest text-fog-dim">
                {f.label}
              </span>
              <select
                name={f.name}
                defaultValue={f.value ?? ""}
                required={f.name === "first"}
                className="border border-panel-line bg-void px-3 py-2 font-mono-fx text-sm text-fog outline-none focus:border-cyan"
              >
                <option value="">{f.name === "first" ? "Select faction..." : "—"}</option>
                {factions.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <label className="flex flex-col gap-1.5">
            <span className="font-mono-fx text-[11px] uppercase tracking-widest text-fog-dim">
              Notes (optional)
            </span>
            <textarea
              name="notes"
              defaultValue={existing?.notes ?? ""}
              rows={2}
              className="border border-panel-line bg-void px-3 py-2 font-body text-sm text-fog outline-none focus:border-cyan"
            />
          </label>

          {state.error && (
            <p className="font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">
              ⚠ {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 self-start border border-yellow/70 bg-yellow px-6 py-2.5 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {pending ? "Submitting..." : existing ? "Update Result" : "Submit Result"}
          </button>
        </form>
      )}
    </div>
  );
}
