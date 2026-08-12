"use client";

import { useState, useTransition } from "react";
import { events, SLOTS_PER_FACTION, MAX_EVENTS_PER_STUDENT, type FestEvent } from "@/lib/data";
import { addRegistration, removeRegistration, createTeam } from "@/app/dashboard/faction-head/actions";
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

interface TeamData {
  id: string;
  name: string;
  subEventKey: string;
  members: Registration[];
}

function sizeLabel(size: number | [number, number]): string {
  return Array.isArray(size) ? `${size[0]}–${size[1]}` : String(size);
}

function sizeMax(size: number | [number, number]): number {
  return Array.isArray(size) ? size[1] : size;
}

export default function RegistrationBoard({
  students,
  registrationsByEvent,
  teamsByEvent,
  factionTotalUsed,
}: {
  students: StudentInfo[];
  registrationsByEvent: Record<string, Registration[]>;
  teamsByEvent: Record<string, TeamData[]>;
  factionTotalUsed: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unassignedCount = students.filter((s) => s.eventCount === 0).length;

  function handleAdd(studentId: string, eventSlug: string, teamId?: string) {
    if (!studentId) return;
    setError(null);
    startTransition(async () => {
      const result = await addRegistration(studentId, eventSlug, teamId);
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

  function handleCreateTeam(eventSlug: string, subEventKey?: string) {
    setError(null);
    startTransition(async () => {
      const result = await createTeam(eventSlug, subEventKey);
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
            teams={teamsByEvent[event.slug] ?? []}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onCreateTeam={handleCreateTeam}
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
  teams,
  onAdd,
  onRemove,
  onCreateTeam,
  disabled,
}: {
  event: FestEvent;
  students: StudentInfo[];
  registrations: Registration[];
  teams: TeamData[];
  onAdd: (studentId: string, eventSlug: string, teamId?: string) => void;
  onRemove: (registrationId: string) => void;
  onCreateTeam: (eventSlug: string, subEventKey?: string) => void;
  disabled: boolean;
}) {
  const totalMembers = event.subEvents
    ? teams.reduce((sum, t) => sum + t.members.length, 0)
    : event.teamConfig
      ? teams.reduce((sum, t) => sum + t.members.length, 0)
      : registrations.length;

  const totalCap = event.subEvents
    ? event.subEvents.reduce((sum, se) => sum + se.teamsPerFaction * sizeMax(se.membersPerTeam), 0)
    : event.teamConfig
      ? event.teamConfig.teamsPerFaction * sizeMax(event.teamConfig.membersPerTeam)
      : (event.flatSlotsPerFaction ?? 0);

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
          {totalMembers} / {totalCap}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {event.subEvents ? (
          event.subEvents.map((se) => (
            <TeamGroup
              key={se.key}
              label={se.label}
              eventSlug={event.slug}
              subEventKey={se.key}
              teamsPerFaction={se.teamsPerFaction}
              membersPerTeam={se.membersPerTeam}
              teams={teams.filter((t) => t.subEventKey === se.key)}
              students={students}
              onAdd={onAdd}
              onRemove={onRemove}
              onCreateTeam={onCreateTeam}
              disabled={disabled}
            />
          ))
        ) : event.teamConfig ? (
          <TeamGroup
            label={null}
            eventSlug={event.slug}
            subEventKey={undefined}
            teamsPerFaction={event.teamConfig.teamsPerFaction}
            membersPerTeam={event.teamConfig.membersPerTeam}
            teams={teams}
            students={students}
            onAdd={onAdd}
            onRemove={onRemove}
            onCreateTeam={onCreateTeam}
            disabled={disabled}
          />
        ) : (
          <FlatRoster
            event={event}
            students={students}
            registrations={registrations}
            onAdd={onAdd}
            onRemove={onRemove}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}

/** One or more fixed-size teams for a single event (or one sub-event, e.g. BGMI within The Grid). */
function TeamGroup({
  label,
  eventSlug,
  subEventKey,
  teamsPerFaction,
  membersPerTeam,
  teams,
  students,
  onAdd,
  onRemove,
  onCreateTeam,
  disabled,
}: {
  label: string | null;
  eventSlug: string;
  subEventKey: string | undefined;
  teamsPerFaction: number;
  membersPerTeam: number | [number, number];
  teams: TeamData[];
  students: StudentInfo[];
  onAdd: (studentId: string, eventSlug: string, teamId?: string) => void;
  onRemove: (registrationId: string) => void;
  onCreateTeam: (eventSlug: string, subEventKey?: string) => void;
  disabled: boolean;
}) {
  const maxSize = sizeMax(membersPerTeam);
  const canStartTeam = teams.length < teamsPerFaction;

  return (
    <div className={label ? "border-l-2 border-panel-line pl-3" : ""}>
      {label && (
        <p className="mb-1.5 font-mono-fx text-[10px] uppercase tracking-widest text-cyan">{label}</p>
      )}
      <div className="flex flex-col gap-2">
        {teams.map((team) => (
          <div key={team.id} className="border border-panel-line bg-void p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono-fx text-xs font-bold uppercase tracking-widest text-fog">
                {team.name}
              </p>
              <span className="font-mono-fx text-[10px] text-fog-dim">
                {team.members.length} / {sizeLabel(membersPerTeam)}
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {team.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 border border-panel-line/60 bg-panel/30 px-2 py-1.5">
                  <span className="font-body text-xs text-fog">
                    {m.name} <span className="font-mono-fx text-[10px] text-fog-dim">· {m.rollNumber}</span>
                  </span>
                  <button
                    onClick={() => onRemove(m.id)}
                    disabled={disabled}
                    className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim transition-colors hover:text-magenta disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {team.members.length < maxSize && (
              <StudentPicker
                eventSlug={eventSlug}
                teamId={team.id}
                excludeIds={new Set(team.members.map((m) => m.studentId))}
                students={students}
                onAdd={onAdd}
                disabled={disabled}
              />
            )}
          </div>
        ))}

        {canStartTeam && (
          <button
            onClick={() => onCreateTeam(eventSlug, subEventKey)}
            disabled={disabled}
            className="self-start border border-cyan/60 px-3 py-1.5 font-mono-fx text-[10px] uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-40"
          >
            + Start Team {teams.length + 1} of {teamsPerFaction}
          </button>
        )}
      </div>
    </div>
  );
}

/** A dropdown + Add button scoped to one team, filtering out students already on it, at cap, or schedule-conflicted. */
function StudentPicker({
  eventSlug,
  teamId,
  excludeIds,
  students,
  onAdd,
  disabled,
}: {
  eventSlug: string;
  teamId: string;
  excludeIds: Set<string>;
  students: StudentInfo[];
  onAdd: (studentId: string, eventSlug: string, teamId?: string) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState("");
  const selectable = students
    .filter((s) => !excludeIds.has(s.id) && s.eventCount < MAX_EVENTS_PER_STUDENT)
    .map((s) => {
      const conflictSlug = findConflict(eventSlug, s.eventSlugs);
      const conflictName = conflictSlug ? (events.find((e) => e.slug === conflictSlug)?.name ?? conflictSlug) : null;
      return { student: s, conflictName };
    });
  const eligible = selectable.filter((s) => !s.conflictName);

  return (
    <div className="mt-2 flex gap-1.5">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={disabled || eligible.length === 0}
        className="flex-1 border border-panel-line bg-void px-2 py-1.5 font-mono-fx text-[11px] text-fog outline-none focus:border-cyan disabled:opacity-40"
      >
        <option value="">{eligible.length === 0 ? "No eligible students" : "Select a student..."}</option>
        {selectable.map(({ student: s, conflictName }) => (
          <option key={s.id} value={s.id} disabled={!!conflictName}>
            {s.name} ({s.rollNumber}) — {s.eventCount}/{MAX_EVENTS_PER_STUDENT} events
            {conflictName ? ` — unavailable, clashes with ${conflictName}` : ""}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          onAdd(selected, eventSlug, teamId);
          setSelected("");
        }}
        disabled={disabled || !selected}
        className="border border-yellow/70 bg-yellow px-3 py-1.5 font-mono-fx text-[11px] font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}

/** The Blacktie Protocol only: flat individual registration, no team grouping. */
function FlatRoster({
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
  onAdd: (studentId: string, eventSlug: string, teamId?: string) => void;
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
  const atCap = registrations.length >= (event.flatSlotsPerFaction ?? 0);

  return (
    <>
      <div className="flex flex-col gap-2">
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
    </>
  );
}
