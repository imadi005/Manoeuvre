"use client";

import { useState, useTransition } from "react";
import { markPresent, markMemberPresent, startEvent, setRoundStatus, closeRound, completeEvent } from "@/app/dashboard/event-lead/actions";
import type { RosterTeam, RosterIndividual, RoundResultsByRound, RoundStatus } from "@/lib/eventRoster";
import type { FestEvent } from "@/lib/data";

interface Unit {
  type: "team" | "student";
  id: string;
  name: string;
  factionName: string;
  subEventKey: string;
  members: { studentId: string; name: string; rollNumber: string; isSubstitute: boolean }[];
}

const RESULT_STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted — awaiting faculty approval",
  faculty_approved: "Faculty approved — awaiting publish",
  faculty_rejected: "Sent back by faculty",
  control_rejected: "Sent back by control room",
  published: "Published to the leaderboard",
};

function unitsFrom(teams: RosterTeam[], individuals: RosterIndividual[]): Unit[] {
  if (teams.length > 0) {
    return teams.map((t) => ({
      type: "team" as const,
      id: t.id,
      name: t.name,
      factionName: t.factionName,
      subEventKey: t.subEventKey || "",
      members: t.members.map((m) => ({ studentId: m.studentId, name: m.name, rollNumber: m.rollNumber, isSubstitute: m.isSubstitute })),
    }));
  }
  return individuals.map((i) => ({
    type: "student" as const,
    id: i.studentId,
    name: i.name,
    factionName: i.factionName,
    subEventKey: "",
    members: [],
  }));
}

function groupByFaction(units: Unit[]): { factionName: string; units: Unit[] }[] {
  const byFaction = new Map<string, Unit[]>();
  for (const u of units) {
    if (!byFaction.has(u.factionName)) byFaction.set(u.factionName, []);
    byFaction.get(u.factionName)!.push(u);
  }
  return [...byFaction.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([factionName, units]) => ({ factionName, units }));
}

function UnitCard({
  unit,
  footer,
  memberAttendance,
}: {
  unit: Unit;
  footer: React.ReactNode;
  /** The Grid only: per-member presence toggles, shown next to each member's name. */
  memberAttendance?: {
    presentStudentIds: Set<string>;
    isPending: boolean;
    onToggle: (teamId: string, studentId: string) => void;
  };
}) {
  return (
    <div className="border border-panel-line bg-panel/40">
      <div className="border-b border-panel-line/60 px-3 py-2">
        <p className="font-body text-sm font-semibold text-fog">{unit.name}</p>
        {unit.members.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1">
            {unit.members.map((m, i) => {
              const present = memberAttendance?.presentStudentIds.has(m.studentId);
              return (
                <li key={i} className="flex items-center justify-between gap-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                  <span>
                    {m.name} <span className="opacity-70">({m.rollNumber})</span>
                    {m.isSubstitute && <span className="ml-1.5 text-yellow">(SUB)</span>}
                  </span>
                  {memberAttendance && (
                    <button
                      onClick={() => memberAttendance.onToggle(unit.id, m.studentId)}
                      disabled={memberAttendance.isPending}
                      className={`shrink-0 border px-2 py-0.5 text-[9px] transition-colors disabled:opacity-40 ${
                        present ? "border-cyan/60 text-cyan" : "border-panel-line text-fog-dim hover:text-fog"
                      }`}
                    >
                      {present ? "✓ Present" : "Mark Present"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="px-3 py-2">{footer}</div>
    </div>
  );
}

export default function EventWorkflowPanel({
  event,
  teams,
  individuals,
  roundResults,
  presentUnitIds,
  presentMemberStudentIds,
  currentRound,
  completedAt,
  resultStatusBySubEvent,
}: {
  event: FestEvent;
  teams: RosterTeam[];
  individuals: RosterIndividual[];
  roundResults: RoundResultsByRound;
  presentUnitIds: Set<string>;
  presentMemberStudentIds: Set<string>;
  currentRound: number;
  completedAt: string | null;
  resultStatusBySubEvent: Record<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalRounds = event.rounds;
  const units = unitsFrom(teams, individuals);

  if (units.length === 0) {
    return (
      <div className="border border-panel-line bg-panel/40 p-6">
        <p className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
          No teams registered for this event yet — faction heads need to enter their rosters first.
        </p>
      </div>
    );
  }

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  const isFinalRound = currentRound === totalRounds;
  const previousRoundResults = currentRound > 1 ? (roundResults[currentRound - 1] ?? {}) : null;
  const unitsInCurrentRound = units.filter((u) =>
    currentRound === 1 ? presentUnitIds.has(u.id) : previousRoundResults?.[u.id] === "advanced"
  );

  // The Grid: BGMI and PES are independent competitions, split for display + final placement.
  const subEventGroups = event.subEvents ?? [{ key: "", label: "" }];

  function finalPlacementCard(u: Unit) {
    const status = roundResults[currentRound]?.[u.id] as RoundStatus | undefined;
    const finalOptions: RoundStatus[] = ["winner", "runner_up", "third"];
    return (
      <UnitCard
        key={u.id}
        unit={u}
        footer={
          <div className="flex flex-wrap gap-1.5">
            {finalOptions.map((tier) => (
              <button
                key={tier}
                onClick={() => run(() => setRoundStatus(currentRound, u.type, u.id, status === tier ? null : tier))}
                disabled={isPending}
                className={`border px-2.5 py-1.5 font-mono-fx text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40 ${
                  status === tier ? "border-yellow bg-yellow text-void" : "border-panel-line text-fog-dim hover:text-fog"
                }`}
              >
                {tier === "winner" ? "Winner" : tier === "runner_up" ? "Runner-Up" : "3rd Position"}
              </button>
            ))}
          </div>
        }
      />
    );
  }

  function advanceCard(u: Unit) {
    const status = roundResults[currentRound]?.[u.id] as RoundStatus | undefined;
    return (
      <UnitCard
        key={u.id}
        unit={u}
        footer={
          <button
            onClick={() => run(() => setRoundStatus(currentRound, u.type, u.id, status === "advanced" ? null : "advanced"))}
            disabled={isPending}
            className={`border px-3 py-1.5 font-mono-fx text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40 ${
              status === "advanced" ? "border-yellow bg-yellow text-void" : "border-panel-line text-fog-dim hover:text-fog"
            }`}
          >
            Advance
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="border border-magenta/40 bg-magenta/10 px-4 py-3 font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">
          ⚠ {error}
        </p>
      )}

      {/* Attendance — always visible so late arrivals can still be marked. */}
      <div>
        <p className="mb-3 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">// Attendance</p>
        <div className="flex flex-col gap-4">
          {groupByFaction(units).map((g) => (
            <div key={g.factionName}>
              <p className="mb-2 font-display text-xs font-bold uppercase tracking-wide text-cyan">{g.factionName}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.units.map((u) => {
                  const present = presentUnitIds.has(u.id);
                  return (
                    <UnitCard
                      key={u.id}
                      unit={u}
                      memberAttendance={
                        event.slug === "the-grid" && u.type === "team"
                          ? {
                              presentStudentIds: presentMemberStudentIds,
                              isPending,
                              onToggle: (teamId, studentId) => run(() => markMemberPresent(teamId, studentId)),
                            }
                          : undefined
                      }
                      footer={
                        present ? (
                          <span className="font-mono-fx text-[10px] uppercase tracking-widest text-cyan">✓ Present</span>
                        ) : (
                          <button
                            onClick={() => run(() => markPresent(u.type, u.id))}
                            disabled={isPending}
                            className="border border-cyan/60 px-3 py-1.5 font-mono-fx text-[10px] uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void disabled:opacity-40"
                          >
                            Mark Present
                          </button>
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {currentRound === 0 && (
        <button
          onClick={() => run(startEvent)}
          disabled={isPending}
          className="self-start border border-yellow/70 bg-yellow px-6 py-2.5 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          Start the Event
        </button>
      )}

      {completedAt ? (
        <div className="flex flex-col gap-4">
          {subEventGroups.map((se) => {
            const finalResults = roundResults[totalRounds] ?? {};
            const unitsHere = se.key ? units.filter((u) => u.subEventKey === se.key) : units;
            return (
              <div key={se.key} className="border border-cyan/40 bg-panel/40 p-5">
                <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-cyan text-glow-cyan">
                  // Event Completed{se.label ? ` — ${se.label}` : ""}
                </p>
                <div className="mt-3 flex flex-col gap-1.5">
                  {(["winner", "runner_up", "third"] as const).map((tier) => {
                    const unitId = Object.entries(finalResults).find(([id, s]) => s === tier && unitsHere.some((u) => u.id === id))?.[0];
                    const unit = units.find((u) => u.id === unitId);
                    const label = tier === "winner" ? "Winner" : tier === "runner_up" ? "Runner-Up" : "3rd Position";
                    return (
                      <p key={tier} className="font-body text-sm text-fog">
                        <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">{label}</span>{" "}
                        {unit ? `${unit.name} (${unit.factionName})` : "—"}
                      </p>
                    );
                  })}
                </div>
                {resultStatusBySubEvent[se.key] && (
                  <p className="mt-3 font-mono-fx text-[10px] uppercase tracking-widest text-yellow">
                    {RESULT_STATUS_LABEL[resultStatusBySubEvent[se.key]] ?? resultStatusBySubEvent[se.key]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        currentRound >= 1 && (
          <div>
            <p className="mb-3 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Round {currentRound}
              {isFinalRound ? " — Final" : ""}
            </p>
            {unitsInCurrentRound.length === 0 ? (
              <p className="font-body text-sm text-fog-dim">Nobody advanced into this round yet.</p>
            ) : isFinalRound && event.subEvents ? (
              <div className="flex flex-col gap-6">
                {event.subEvents.map((se) => {
                  const unitsHere = unitsInCurrentRound.filter((u) => u.subEventKey === se.key);
                  return (
                    <div key={se.key}>
                      <p className="mb-2 font-mono-fx text-[11px] uppercase tracking-widest text-cyan">{se.label}</p>
                      {unitsHere.length === 0 ? (
                        <p className="font-body text-xs text-fog-dim">Nobody advanced into this round yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{unitsHere.map(finalPlacementCard)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {unitsInCurrentRound.map((u) => (isFinalRound ? finalPlacementCard(u) : advanceCard(u)))}
              </div>
            )}

            <button
              onClick={() => run(isFinalRound ? completeEvent : () => closeRound(currentRound))}
              disabled={isPending}
              className="mt-4 self-start border border-magenta/70 bg-magenta px-6 py-2.5 font-mono-fx text-xs font-bold uppercase tracking-widest text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {isFinalRound ? "Mark Event Completed" : `Mark Round ${currentRound} Closed`}
            </button>
          </div>
        )
      )}
    </div>
  );
}
