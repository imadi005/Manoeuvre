"use client";

import { useState, useTransition } from "react";
import { events, SLOTS_PER_FACTION, MAX_EVENTS_PER_STUDENT, type FestEvent } from "@/lib/data";
import { addRegistration, removeRegistration } from "@/app/dashboard/faction-head/actions";
import { findConflict } from "@/lib/scheduleConflicts";

interface StudentInfo {
  id: string;
  name: string;
  rollNumber: string;
  eventCount: number;
  eventSlugs: string[];
}

interface Registration {
  id: string;
  studentId: string;
  name: string;
  rollNumber: string;
}

export default function RegistrationBoard({
  students,
  registrationsByEvent,
  factionTotalUsed,
}: {
  students: StudentInfo[];
  registrationsByEvent: Record<string, Registration[]>;
  factionTotalUsed: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unassignedCount = students.filter((s) => s.eventCount === 0).length;

  function handleAdd(studentId: string, eventSlug: string) {
    if (!studentId) return;
    setError(null);
    startTransition(async () => {
      const result = await addRegistration(studentId, eventSlug);
      if (result.error) setError(result.error);
    });
  }

  function handleRemove(registrationId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeRegistration(registrationId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 border border-panel-line bg-panel/40 p-4">
        <p className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
          Faction slots used: <span className="text-fog">{factionTotalUsed}</span> / {SLOTS_PER_FACTION}
        </p>
        <p className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
          Unassigned students:{" "}
          <span className={unassignedCount > 0 ? "text-magenta" : "text-fog"}>{unassignedCount}</span>
        </p>
      </div>

      {error && (
        <p className="mt-4 font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">
          ⚠ {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {events.map((event) => (
          <EventCard
            key={event.slug}
            event={event}
            students={students}
            registrations={registrationsByEvent[event.slug] ?? []}
            onAdd={handleAdd}
            onRemove={handleRemove}
            disabled={isPending}
          />
        ))}
      </div>
    </div>
  );
}

function EventCard({
  event,
  students,
  registrations,
  onAdd,
  onRemove,
  disabled,
}: {
  event: FestEvent;
  students: StudentInfo[];
  registrations: Registration[];
  onAdd: (studentId: string, eventSlug: string) => void;
  onRemove: (registrationId: string) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState("");
  const registeredIds = new Set(registrations.map((r) => r.studentId));
  const selectable = students
    .filter((s) => !registeredIds.has(s.id) && s.eventCount < MAX_EVENTS_PER_STUDENT)
    .map((s) => {
      const conflictSlug = findConflict(event.slug, s.eventSlugs);
      const conflictName = conflictSlug ? (events.find((e) => e.slug === conflictSlug)?.name ?? conflictSlug) : null;
      return { student: s, conflictName };
    });
  const eligible = selectable.filter((s) => !s.conflictName);
  const atCap = !event.allowsExtraSquads && registrations.length >= event.participantsPerFaction;

  return (
    <div className="border border-panel-line bg-panel/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
            {event.category}
          </p>
          <h3 className="font-display text-lg font-bold uppercase text-fog">{event.name}</h3>
        </div>
        <span className="whitespace-nowrap font-mono-fx text-xs text-fog-dim">
          {registrations.length} / {event.participantsPerFaction}
          {event.allowsExtraSquads ? "+" : ""}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {registrations.length === 0 && (
          <p className="font-body text-sm text-fog-dim">No one registered yet.</p>
        )}
        {registrations.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 border border-panel-line bg-void px-3 py-2"
          >
            <span className="font-body text-sm text-fog">
              {r.name} <span className="font-mono-fx text-xs text-fog-dim">· {r.rollNumber}</span>
            </span>
            <button
              onClick={() => onRemove(r.id)}
              disabled={disabled}
              className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-magenta disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {atCap ? (
        <p className="mt-4 font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
          Faction slots full for this event.
        </p>
      ) : (
        <div className="mt-4 flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={disabled || eligible.length === 0}
            className="flex-1 border border-panel-line bg-void px-2 py-2 font-mono-fx text-xs text-fog outline-none focus:border-cyan disabled:opacity-40"
          >
            <option value="">
              {eligible.length === 0 ? "No eligible students" : "Select a student..."}
            </option>
            {selectable.map(({ student: s, conflictName }) => (
              <option key={s.id} value={s.id} disabled={!!conflictName}>
                {s.name} ({s.rollNumber}) — {s.eventCount}/{MAX_EVENTS_PER_STUDENT} events
                {conflictName ? ` — unavailable, clashes with ${conflictName}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              onAdd(selected, event.slug);
              setSelected("");
            }}
            disabled={disabled || !selected}
            className="border border-yellow/70 bg-yellow px-4 py-2 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
