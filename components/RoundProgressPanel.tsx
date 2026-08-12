"use client";

import { useState, useTransition } from "react";
import { setRoundStatus } from "@/app/dashboard/event-lead/actions";
import type { RosterTeam, RosterIndividual, RoundResultsByRound, RoundStatus } from "@/lib/eventRoster";

const STATUS_LABEL: Record<RoundStatus, string> = {
  advanced: "Advanced",
  eliminated: "Eliminated",
  winner: "Winner",
  runner_up: "Runner-Up",
};

export default function RoundProgressPanel({
  totalRounds,
  teams,
  individuals,
  roundResults,
}: {
  totalRounds: number;
  teams: RosterTeam[];
  individuals: RosterIndividual[];
  roundResults: RoundResultsByRound;
}) {
  const [round, setRound] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isFinalRound = round === totalRounds;

  const statusOptions: RoundStatus[] = isFinalRound
    ? ["winner", "runner_up", "eliminated"]
    : ["advanced", "eliminated"];

  function handleSet(unitType: "team" | "student", unitId: string, status: RoundStatus | null) {
    setError(null);
    startTransition(async () => {
      const result = await setRoundStatus(round, unitType, unitId, status);
      if (result.error) setError(result.error);
    });
  }

  const units = teams.length > 0
    ? teams.map((t) => ({
        type: "team" as const,
        id: t.id,
        label: t.name,
        sub: `${t.factionName}${t.members.length ? " · " + t.members.map((m) => `${m.name} (${m.rollNumber})`).join(", ") : ""}`,
      }))
    : individuals.map((i) => ({
        type: "student" as const,
        id: i.studentId,
        label: `${i.name} (${i.rollNumber})`,
        sub: i.factionName,
      }));

  const currentStatuses = roundResults[round] ?? {};

  if (units.length === 0) {
    return (
      <div className="border border-panel-line bg-panel/40 p-6">
        <p className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
          No teams registered for this event yet — faction heads need to enter their rosters first.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
          <button
            key={r}
            onClick={() => setRound(r)}
            className={`border px-4 py-2 font-mono-fx text-xs uppercase tracking-widest transition-colors ${
              r === round
                ? "border-cyan bg-cyan text-void"
                : "border-panel-line text-fog-dim hover:text-fog"
            }`}
          >
            Round {r}
            {r === totalRounds ? " (Final)" : ""}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 border border-magenta/40 bg-magenta/10 px-4 py-3 font-mono-fx text-xs uppercase tracking-wide text-magenta text-glow-magenta">
          ⚠ {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {units.map((u) => {
          const current = currentStatuses[u.id] as RoundStatus | undefined;
          return (
            <div
              key={u.id}
              className="flex flex-col gap-2 border border-panel-line bg-panel/40 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-body text-sm font-semibold text-fog">{u.label}</p>
                <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">{u.sub}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSet(u.type, u.id, current === s ? null : s)}
                    disabled={isPending}
                    className={`border px-3 py-1.5 font-mono-fx text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40 ${
                      current === s
                        ? s === "eliminated"
                          ? "border-magenta bg-magenta text-void"
                          : "border-yellow bg-yellow text-void"
                        : "border-panel-line text-fog-dim hover:text-fog"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
