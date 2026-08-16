"use client";

import { useState, useTransition } from "react";
import { events, type FestEvent } from "@/lib/data";
import { addRegistration, removeRegistration, createTeam } from "@/app/dashboard/faction-head/actions";
import { findConflict } from "@/lib/scheduleConflicts";
import StudentSearchPicker from "@/components/StudentSearchPicker";
import type { StudentInfo, Registration, TeamData } from "@/lib/factionRoster";

function sizeLabel(size: number | [number, number]): string {
  return Array.isArray(size) ? `${size[0]}–${size[1]}` : String(size);
}

function sizeMax(size: number | [number, number]): number {
  return Array.isArray(size) ? size[1] : size;
}

export default function EventRegistrationPanel({
  event,
  students,
  registrations,
  teams,
}: {
  event: FestEvent;
  students: StudentInfo[];
  registrations: Registration[];
  teams: TeamData[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(studentId: string, teamId?: string, isSubstitute?: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await addRegistration(studentId, event.slug, teamId, isSubstitute);
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

  function handleCreateTeam(subEventKey?: string) {
    setError(null);
    startTransition(async () => {
      const result = await createTeam(event.slug, subEventKey);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-4 border border-magenta/40 bg-magenta/10 px-4 py-3 font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">
          ⚠ {error}
        </p>
      )}

      {event.subEvents ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {event.subEvents.map((se) => (
            <TeamGroup
              key={se.key}
              label={se.label}
              subEventKey={se.key}
              teamsPerFaction={se.teamsPerFaction}
              membersPerTeam={se.membersPerTeam}
              teams={teams.filter((t) => t.subEventKey === se.key)}
              students={students}
              eventSlug={event.slug}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onCreateTeam={handleCreateTeam}
              disabled={isPending}
            />
          ))}
        </div>
      ) : event.teamConfig ? (
        <TeamGroup
          label={null}
          subEventKey={undefined}
          teamsPerFaction={event.teamConfig.teamsPerFaction}
          membersPerTeam={event.teamConfig.membersPerTeam}
          teams={teams}
          students={students}
          eventSlug={event.slug}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onCreateTeam={handleCreateTeam}
          disabled={isPending}
        />
      ) : (
        <FlatRoster
          event={event}
          students={students}
          registrations={registrations}
          onAdd={handleAdd}
          onRemove={handleRemove}
          disabled={isPending}
        />
      )}
    </div>
  );
}

function TeamGroup({
  label,
  subEventKey,
  teamsPerFaction,
  membersPerTeam,
  teams,
  students,
  eventSlug,
  onAdd,
  onRemove,
  onCreateTeam,
  disabled,
}: {
  label: string | null;
  subEventKey: string | undefined;
  teamsPerFaction: number;
  membersPerTeam: number | [number, number];
  teams: TeamData[];
  students: StudentInfo[];
  eventSlug: string;
  onAdd: (studentId: string, teamId?: string, isSubstitute?: boolean) => void;
  onRemove: (registrationId: string) => void;
  onCreateTeam: (subEventKey?: string) => void;
  disabled: boolean;
}) {
  const maxSize = sizeMax(membersPerTeam);
  const canStartTeam = teams.length < teamsPerFaction;

  return (
    <div>
      {label && (
        <p className="mb-3 font-mono-fx text-xs uppercase tracking-[0.3em] text-cyan text-glow-cyan">
          // {label}
        </p>
      )}
      <div className="flex flex-col gap-4">
        {teams.map((team) => (
          <div key={team.id} className="border border-panel-line bg-panel/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-base font-bold uppercase tracking-wide text-fog">
                {team.name}
              </p>
              <span className="font-mono-fx text-xs text-fog-dim">
                {team.members.length} / {sizeLabel(membersPerTeam)}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {team.members.length === 0 && (
                <p className="font-body text-xs text-fog-dim">No members yet.</p>
              )}
              {team.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 border border-panel-line/60 bg-void px-3 py-2">
                  <span className="font-body text-sm text-fog">
                    {m.name} <span className="font-mono-fx text-xs text-fog-dim">· {m.rollNumber}</span>
                    {m.isSubstitute && (
                      <span className="ml-2 font-mono-fx text-[10px] uppercase tracking-widest text-yellow">(Sub)</span>
                    )}
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
              <div className="mt-3">
                <StudentPickerFor
                  eventSlug={eventSlug}
                  teamId={team.id}
                  excludeIds={new Set(team.members.map((m) => m.studentId))}
                  students={students}
                  onAdd={onAdd}
                  disabled={disabled}
                  allowSubstitute={!!subEventKey}
                />
              </div>
            )}
          </div>
        ))}

        {canStartTeam && (
          <button
            onClick={() => onCreateTeam(subEventKey)}
            disabled={disabled}
            className="self-start border border-cyan/60 px-4 py-2 font-mono-fx text-xs uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-40"
          >
            + Start Team {teams.length + 1} of {teamsPerFaction}
          </button>
        )}
      </div>
    </div>
  );
}

function StudentPickerFor({
  eventSlug,
  teamId,
  excludeIds,
  students,
  onAdd,
  disabled,
  allowSubstitute,
}: {
  eventSlug: string;
  teamId: string;
  excludeIds: Set<string>;
  students: StudentInfo[];
  onAdd: (studentId: string, teamId?: string, isSubstitute?: boolean) => void;
  disabled: boolean;
  allowSubstitute: boolean;
}) {
  const [isSubstitute, setIsSubstitute] = useState(false);

  const candidates = students
    .filter((s) => !excludeIds.has(s.id))
    .map((s) => {
      // A substitute add skips the schedule-conflict check entirely.
      const conflictSlug = isSubstitute ? null : findConflict(eventSlug, s.eventSlugs);
      const conflictName = conflictSlug ? (events.find((e) => e.slug === conflictSlug)?.name ?? conflictSlug) : null;
      return { id: s.id, name: s.name, rollNumber: s.rollNumber, eventCount: s.eventCount, conflictName };
    });

  return (
    <div>
      {allowSubstitute && (
        <label className="mb-2 flex items-center gap-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
          <input
            type="checkbox"
            checked={isSubstitute}
            onChange={(e) => setIsSubstitute(e.target.checked)}
            disabled={disabled}
          />
          Register as substitute (exempt from schedule clash)
        </label>
      )}
      <StudentSearchPicker
        candidates={candidates}
        onPick={(studentId) => onAdd(studentId, teamId, isSubstitute)}
        disabled={disabled}
      />
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
  onAdd: (studentId: string, teamId?: string) => void;
  onRemove: (registrationId: string) => void;
  disabled: boolean;
}) {
  const registeredIds = new Set(registrations.map((r) => r.studentId));
  const atCap = registrations.length >= (event.flatSlotsPerFaction ?? 0);

  const candidates = students
    .filter((s) => !registeredIds.has(s.id))
    .map((s) => {
      const conflictSlug = findConflict(event.slug, s.eventSlugs);
      const conflictName = conflictSlug ? (events.find((e) => e.slug === conflictSlug)?.name ?? conflictSlug) : null;
      return { id: s.id, name: s.name, rollNumber: s.rollNumber, eventCount: s.eventCount, conflictName };
    });

  return (
    <div className="border border-panel-line bg-panel/50 p-4">
      <div className="flex flex-col gap-1.5">
        {registrations.length === 0 && (
          <p className="font-body text-sm text-fog-dim">No one registered yet.</p>
        )}
        {registrations.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 border border-panel-line/60 bg-void px-3 py-2">
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
        <div className="mt-4">
          <StudentSearchPicker
            candidates={candidates}
            onPick={(studentId) => onAdd(studentId)}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
