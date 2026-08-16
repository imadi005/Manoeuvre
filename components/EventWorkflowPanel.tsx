"use client";

import { useState, useTransition } from "react";
import { markPresent, startEvent, setRoundStatus, closeRound, completeEvent } from "@/app/dashboard/event-lead/actions";
import type { RosterTeam, RosterIndividual, RoundResultsByRound, RoundStatus } from "@/lib/eventRoster";

interface Unit {
  type: "team" | "student";
  id: string;
  name: string;
  factionName: string;
  members: { name: string; rollNumber: string }[];
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
      members: t.members.map((m) => ({ name: m.name, rollNumber: m.rollNumber })),
    }));
  }
  return individuals.map((i) => ({
    type: "student" as const,
    id: i.studentId,
    name: i.name,
    factionName: i.factionName,
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

function UnitCard({ unit, footer }: { unit: Unit; footer: React.ReactNode }) {
  return (
    <div className="border border-panel-line bg-panel/40">
      <div className="border-b border-panel-line/60 px-3 py-2">
        <p className="font-body text-sm font-semibold text-fog">{unit.name}</p>
        {unit.members.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5">
            {unit.members.map((m, i) => (
              <li key={i} className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                {m.name} <span className="opacity-70">({m.rollNumber})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="px-3 py-2">{footer}</div>
    </div>
  );
}

export default function EventWorkflowPanel({
  totalRounds,
  teams,
  individuals,
  roundResults,
  presentUnitIds,
  currentRound,
  completedAt,
  resultStatus,
}: {
  totalRounds: number;
  teams: RosterTeam[];
  individuals: RosterIndividual[];
  roundResults: RoundResultsByRound;
  presentUnitIds: Set<string>;
  currentRound: number;
  completedAt: string | null;
  resultStatus: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        <div className="border border-cyan/40 bg-panel/40 p-5">
          <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-cyan text-glow-cyan">// Event Completed</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {(["winner", "runner_up", "third"] as const).map((tier) => {
              const unitId = Object.entries(roundResults[totalRounds] ?? {}).find(([, s]) => s === tier)?.[0];
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
          {resultStatus && (
            <p className="mt-3 font-mono-fx text-[10px] uppercase tracking-widest text-yellow">
              {RESULT_STATUS_LABEL[resultStatus] ?? resultStatus}
            </p>
          )}
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
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {unitsInCurrentRound.map((u) => {
                  const status = roundResults[currentRound]?.[u.id] as RoundStatus | undefined;
                  const finalOptions: RoundStatus[] = ["winner", "runner_up", "third"];
                  return (
                    <UnitCard
                      key={u.id}
                      unit={u}
                      footer={
                        isFinalRound ? (
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
                        ) : (
                          <button
                            onClick={() => run(() => setRoundStatus(currentRound, u.type, u.id, status === "advanced" ? null : "advanced"))}
                            disabled={isPending}
                            className={`border px-3 py-1.5 font-mono-fx text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40 ${
                              status === "advanced" ? "border-yellow bg-yellow text-void" : "border-panel-line text-fog-dim hover:text-fog"
                            }`}
                          >
                            Advance
                          </button>
                        )
                      }
                    />
                  );
                })}
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
