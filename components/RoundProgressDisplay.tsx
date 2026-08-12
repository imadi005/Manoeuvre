import type { RosterTeam, RosterIndividual, RoundResultsByRound, RoundStatus } from "@/lib/eventRoster";

const STATUS_LABEL: Record<RoundStatus, string> = {
  advanced: "Advanced",
  eliminated: "Eliminated",
  winner: "Winner",
  runner_up: "Runner-Up",
};

const STATUS_COLOR: Record<RoundStatus, string> = {
  advanced: "text-cyan",
  eliminated: "text-fog-dim line-through",
  winner: "text-yellow text-glow-yellow",
  runner_up: "text-yellow",
};

export default function RoundProgressDisplay({
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
  const hasAnyResults = Object.keys(roundResults).length > 0;
  if (!hasAnyResults) return null;

  const units = teams.length > 0
    ? teams.map((t) => ({
        id: t.id,
        label: t.name,
        sub: t.members.map((m) => `${m.name} (${m.rollNumber})`).join(", "),
      }))
    : individuals.map((i) => ({
        id: i.studentId,
        label: `${i.name} (${i.rollNumber})`,
        sub: i.factionName,
      }));

  const roundsWithData = Array.from({ length: totalRounds }, (_, i) => i + 1).filter(
    (r) => roundResults[r] && Object.keys(roundResults[r]).length > 0
  );

  if (roundsWithData.length === 0) return null;

  return (
    <div className="mt-8 border border-panel-line bg-panel/40 p-6">
      <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
        // Round Progress
      </p>
      <div className="mt-4 flex flex-col gap-6">
        {roundsWithData.map((r) => {
          const statuses = roundResults[r];
          const entries = units
            .map((u) => ({ ...u, status: statuses[u.id] as RoundStatus | undefined }))
            .filter((u) => u.status);
          if (entries.length === 0) return null;
          return (
            <div key={r}>
              <p className="font-mono-fx text-[11px] uppercase tracking-widest text-cyan">
                Round {r}
                {r === totalRounds ? " — Final" : ""}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {entries.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-panel-line/40 py-1.5 last:border-b-0">
                    <div>
                      <span className="font-body text-sm text-fog">{e.label}</span>
                      {e.sub && (
                        <span className="ml-2 font-mono-fx text-[10px] text-fog-dim">{e.sub}</span>
                      )}
                    </div>
                    <span className={`font-mono-fx text-[10px] uppercase tracking-widest ${STATUS_COLOR[e.status!]}`}>
                      {STATUS_LABEL[e.status!]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
