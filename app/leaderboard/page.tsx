import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { createAdminClient } from "@/lib/supabase/admin";
import { factions, events } from "@/lib/data";
import { computeFactionTotals, computeParticipationTotals, mergeFactionTotals, pointsForPlacement } from "@/lib/scoring";

export const revalidate = 30;

export default async function LeaderboardPage() {
  const supabase = createAdminClient();
  // Counts the moment the event lead submits a result -- faculty/control-room
  // approval still runs, but no longer gates the leaderboard. Only an explicit
  // rejection at either stage pulls a result back out.
  const { data: verified } = await supabase
    .from("event_results")
    .select("event_slug, sub_event, first_faction_id, second_faction_id, third_faction_id")
    .in("status", ["submitted", "faculty_approved", "published"]);

  const { data: attendance } = await supabase.from("event_attendance").select("event_slug, faction_id, sub_event");

  // Need faction DB ids to match against event_results (which store uuid, not slug).
  const { data: factionRows } = await supabase.from("factions").select("id, slug");
  const slugById = new Map((factionRows ?? []).map((f) => [f.id, f.slug]));

  const totals = mergeFactionTotals(computeFactionTotals(verified ?? []), computeParticipationTotals(attendance ?? []));
  const totalsBySlug = new Map<string, number>();
  for (const [factionId, points] of totals) {
    const slug = slugById.get(factionId);
    if (slug) totalsBySlug.set(slug, points);
  }

  const rankedBySlug = [...factions]
    .map((f) => ({ faction: f, points: totalsBySlug.get(f.slug) ?? 0 }))
    .sort((a, b) => b.points - a.points);

  const maxPoints = Math.max(1, ...rankedBySlug.map((r) => r.points));

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <Reveal className="text-center">
            <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-yellow text-glow-yellow">
              // Live Standings
            </p>
            <h1 className="font-display mt-3 text-3xl font-black uppercase text-fog sm:text-4xl">
              The <span className="text-magenta text-glow-magenta">Leaderboard.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl font-body text-sm text-fog-dim">
              Participation points count the moment a team shows up. Winner /
              Runner-up / 3rd points count once a result clears faculty
              approval and control room publishes it. Updates as the fest happens.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-12 flex flex-col gap-3">
            {rankedBySlug.map((r, i) => (
              <div
                key={r.faction.slug}
                style={{ "--accent": r.faction.accent } as React.CSSProperties}
                className="relative flex items-center gap-4 overflow-hidden border border-panel-line bg-panel/40 p-4"
              >
                <span className="font-display w-8 flex-shrink-0 text-center text-xl font-black text-fog-dim">
                  {i + 1}
                </span>
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden border border-panel-line">
                  <Image src={r.faction.logo} alt={r.faction.name} fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-glow-accent font-display truncate text-sm font-bold uppercase">
                    {r.faction.name}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden bg-void">
                    <div
                      className="h-full"
                      style={{
                        width: `${(r.points / maxPoints) * 100}%`,
                        backgroundColor: "var(--accent)",
                      }}
                    />
                  </div>
                </div>
                <span className="text-glow-accent font-display flex-shrink-0 text-xl font-black">
                  {r.points}
                </span>
              </div>
            ))}
          </Reveal>

          <Reveal delay={0.2} className="mt-16">
            <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Published Results
            </p>
            {(verified ?? []).length === 0 ? (
              <p className="mt-4 font-body text-sm text-fog-dim">
                No results published yet. Check back once events start
                wrapping up.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {(verified ?? []).map((r) => {
                  const event = events.find((e) => e.slug === r.event_slug);
                  const subEventLabel = event?.subEvents?.find((se) => se.key === r.sub_event)?.label;
                  const placementText = (
                    factionId: string | null,
                    tier: "winner" | "runner_up" | "third"
                  ) => {
                    if (!factionId) return null;
                    const slug = slugById.get(factionId);
                    const faction = factions.find((f) => f.slug === slug);
                    const pts = pointsForPlacement(r.event_slug, tier, r.sub_event);
                    return faction ? `${faction.name} (+${pts})` : null;
                  };
                  return (
                    <Link
                      key={`${r.event_slug}-${r.sub_event}`}
                      href={`/events/${r.event_slug}`}
                      className="border border-panel-line bg-panel/30 p-4 transition-colors hover:border-cyan"
                    >
                      <p className="font-display text-sm font-bold uppercase text-fog">
                        {event?.name ?? r.event_slug}
                        {subEventLabel && <span className="ml-2 text-fog-dim">— {subEventLabel}</span>}
                      </p>
                      <p className="mt-1 font-mono-fx text-xs text-fog-dim">
                        {[
                          placementText(r.first_faction_id, "winner"),
                          placementText(r.second_faction_id, "runner_up"),
                          placementText(r.third_faction_id, "third"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </Reveal>
        </div>
      </main>
      <Footer />
    </>
  );
}
