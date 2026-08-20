import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { events, totalSlotsForEvent } from "@/lib/data";
import { getEventScheduleBlocks } from "@/lib/schedule";
import { getEventRoster } from "@/lib/eventRoster";
import RoundProgressDisplay from "@/components/RoundProgressDisplay";
import EventGallery from "@/components/EventGallery";
import { createAdminClient } from "@/lib/supabase/admin";

const glowText: Record<string, string> = {
  magenta: "text-magenta text-glow-magenta",
  cyan: "text-cyan text-glow-cyan",
  yellow: "text-yellow text-glow-yellow",
};

const glowBorder: Record<string, string> = {
  magenta: "border-magenta/40",
  cyan: "border-cyan/40",
  yellow: "border-yellow/40",
};

function sizeLabel(size: number | [number, number]): string {
  return Array.isArray(size) ? `${size[0]}–${size[1]}` : String(size);
}

function teamStructureLabel(event: (typeof events)[number]): string {
  if (event.subEvents) {
    return event.subEvents.map((se) => `${se.label} ${sizeLabel(se.membersPerTeam)}`).join(" · ");
  }
  if (!event.teamConfig) return `${event.flatSlotsPerFaction ?? 0} individual`;
  const { teamsPerFaction, membersPerTeam } = event.teamConfig;
  return `${teamsPerFaction} team${teamsPerFaction > 1 ? "s" : ""} of ${sizeLabel(membersPerTeam)}`;
}

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = events.find((e) => e.slug === slug);
  if (!event) notFound();

  const { teams, individuals, roundResults } = await getEventRoster(slug);
  const scheduleBlocks = getEventScheduleBlocks(slug);

  // Public gallery: normal photos only -- geotagged originals stay internal,
  // used only for documentation/verification, never shown here.
  const supabase = createAdminClient();
  const { data: photoRows } = await supabase
    .from("event_photos")
    .select("id, storage_path")
    .eq("event_slug", slug)
    .eq("photo_type", "normal")
    .order("created_at", { ascending: false });
  const galleryPhotos = (photoRows ?? []).map((p, i) => ({
    id: p.id,
    url: supabase.storage.from("event-photos").getPublicUrl(p.storage_path).data.publicUrl,
    name: `${event.slug}-${i + 1}.${p.storage_path.split(".").pop() || "jpg"}`,
  }));

  // Group into per-faction blocks for the public roster — empty teams (started, nobody added yet) are hidden.
  const nonEmptyTeams = teams.filter((t) => t.members.length > 0);
  const factionNames = [...new Set([...nonEmptyTeams.map((t) => t.factionName), ...individuals.map((i) => i.factionName)])].sort();
  const rosterByFaction = factionNames.map((factionName) => ({
    factionName,
    teams: nonEmptyTeams.filter((t) => t.factionName === factionName),
    individuals: individuals.filter((i) => i.factionName === factionName),
  }));

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <Reveal>
            <Link
              href="/#events"
              className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-cyan"
            >
              ← All events
            </Link>

            <p className="mt-6 font-mono-fx text-xs uppercase tracking-[0.4em] text-fog-dim">
              {event.category}
            </p>
            <h1
              className={`font-display mt-2 text-4xl font-black uppercase leading-tight sm:text-5xl ${glowText[event.glow]}`}
            >
              {event.name}
            </h1>
            <p className="mt-4 font-body text-base text-fog sm:text-lg">
              {event.tagline}
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-12 space-y-4">
            {event.briefing.map((p, i) => (
              <p key={i} className="font-body text-sm leading-relaxed text-fog sm:text-base">
                {p}
              </p>
            ))}
          </Reveal>

          <Reveal delay={0.2} className={`mt-12 border ${glowBorder[event.glow]} bg-panel/50 p-6`}>
            <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Format
            </p>
            <ul className="mt-4 space-y-3">
              {event.format.map((f, i) => (
                <li key={i} className="flex gap-3 font-body text-sm text-fog sm:text-base">
                  <span className={glowText[event.glow]}>▸</span>
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>

          {scheduleBlocks.length > 0 && (
            <Reveal delay={0.25} className={`mt-8 border ${glowBorder[event.glow]} bg-panel/50 p-6`}>
              <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
                // Locked Schedule
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse font-mono-fx text-xs">
                  <thead>
                    <tr>
                      <th className="border-b border-panel-line py-2 text-left uppercase tracking-widest text-fog-dim">Date</th>
                      <th className="border-b border-panel-line py-2 text-left uppercase tracking-widest text-fog-dim">Time</th>
                      <th className="border-b border-panel-line py-2 text-left uppercase tracking-widest text-fog-dim">Venue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleBlocks.map((b, i) => (
                      <tr key={i}>
                        <td className="border-b border-panel-line/40 py-2 text-fog">{b.date}</td>
                        <td className="border-b border-panel-line/40 py-2 text-fog">{b.time}</td>
                        <td className={`border-b border-panel-line/40 py-2 ${glowText[event.glow]}`}>{b.venue ?? "TBD"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          )}

          <Reveal delay={0.3} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Per Faction", value: `${totalSlotsForEvent(event)} slots (${teamStructureLabel(event)})` },
              { label: "Rounds", value: String(event.rounds) },
              {
                label: "Points",
                value: event.pointsTier.points !== null ? `${event.pointsTier.label} — ${event.pointsTier.points}` : event.pointsTier.label,
              },
            ].map((s) => (
              <div key={s.label} className="border border-panel-line bg-panel/40 p-4 text-center">
                <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                  {s.label}
                </p>
                <p className="mt-2 font-display text-sm uppercase text-fog">{s.value}</p>
              </div>
            ))}
          </Reveal>

          {rosterByFaction.length > 0 && (
            <Reveal delay={0.33} className={`mt-8 border ${glowBorder[event.glow]} bg-panel/50 p-6`}>
              <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
                // Registered
              </p>
              <div className="mt-4 flex flex-col gap-4">
                {rosterByFaction.map((f) => (
                  <div key={f.factionName} className="border border-panel-line/60 bg-void px-4 py-3">
                    <p className="font-display text-sm font-bold uppercase tracking-wide text-fog">{f.factionName}</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {f.teams.map((t) => (
                        <div key={t.id}>
                          <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">{t.name}</p>
                          <p className="font-body text-xs text-fog">
                            {t.members.map((m) => `${m.name} (${m.rollNumber})${m.isSubstitute ? " (Sub)" : ""}`).join(", ")}
                          </p>
                        </div>
                      ))}
                      {f.individuals.length > 0 && (
                        <p className="font-body text-xs text-fog">
                          {f.individuals.map((i) => `${i.name} (${i.rollNumber})`).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          <Reveal delay={0.35}>
            <RoundProgressDisplay
              totalRounds={event.rounds}
              teams={teams}
              individuals={individuals}
              roundResults={roundResults}
            />
          </Reveal>

          <Reveal delay={0.37}>
            <EventGallery photos={galleryPhotos} borderClass={glowBorder[event.glow]} />
          </Reveal>

          {rosterByFaction.length === 0 && (
            <Reveal delay={0.4} className="mt-10 font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
              Full rules, exact timings, and participant rosters go live once
              faction coordinators complete entries.
            </Reveal>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
