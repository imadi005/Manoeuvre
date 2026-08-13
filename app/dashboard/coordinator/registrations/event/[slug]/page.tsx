import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getRegistrationsOverview } from "@/lib/registrationsOverview";
import { events, totalSlotsForEvent } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default async function EventDrilldownPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "main_coordinator") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const { slug } = await params;
  const event = events.find((e) => e.slug === slug);
  if (!event) notFound();

  const { factions, teams, flatRegs } = await getRegistrationsOverview();
  const factionNameById = new Map(factions.map((f) => [f.id, f]));

  const eventTeams = teams.filter((t) => t.eventSlug === slug);
  const eventFlat = flatRegs.filter((r) => r.eventSlug === slug);
  const totalPeople = eventTeams.reduce((s, t) => s + t.members.length, 0) + eventFlat.length;

  const factionsInvolved = new Set([...eventTeams.map((t) => t.factionId), ...eventFlat.map((r) => r.factionId)]);

  const rows = factions
    .map((f) => {
      const fTeams = eventTeams.filter((t) => t.factionId === f.id);
      const fFlat = eventFlat.filter((r) => r.factionId === f.id);
      const filled = fTeams.reduce((s, t) => s + t.members.length, 0) + fFlat.length;
      return { faction: f, teams: fTeams, flat: fFlat, filled };
    })
    .filter((r) => r.teams.length > 0 || r.flat.length > 0);

  // totalSlotsForEvent is a per-faction cap — multiply out across every faction for the platform-wide total shown here.
  const total = totalSlotsForEvent(event) * factions.length;

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-5xl">
          <Link
            href="/dashboard/coordinator/registrations"
            className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-cyan"
          >
            ← Registrations Overview
          </Link>

          <p className="mt-4 font-mono-fx text-xs uppercase tracking-[0.4em] text-yellow text-glow-yellow">
            // Event Drilldown
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">{event.name}</h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            {totalPeople}/{total} filled · {eventTeams.length} team{eventTeams.length === 1 ? "" : "s"} ·{" "}
            {factionsInvolved.size} faction{factionsInvolved.size === 1 ? "" : "s"} registered
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {rows.length === 0 && (
              <p className="font-body text-sm text-fog-dim">No faction has registered for this event yet.</p>
            )}
            {rows.map(({ faction, teams: fTeams, flat: fFlat, filled }) => (
              <div key={faction.id} className="border border-panel-line bg-panel/40">
                <div className="flex items-center justify-between border-b border-panel-line px-4 py-3">
                  <Link
                    href={`/dashboard/coordinator/registrations/faction/${faction.slug}`}
                    className="font-display text-sm font-bold uppercase text-fog transition-colors hover:text-cyan"
                  >
                    {faction.name}
                  </Link>
                  <span className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
                    {filled} people
                    {fTeams.length > 0 && ` · ${fTeams.length} team${fTeams.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="flex flex-col gap-2 px-4 py-3">
                  {fTeams.map((t) => (
                    <div key={t.id} className="border border-panel-line/60 bg-void px-3 py-2">
                      <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                        {t.name}
                        <span className="ml-2 text-fog-dim/70">
                          ({t.members.length} member{t.members.length === 1 ? "" : "s"})
                        </span>
                      </p>
                      {t.members.length === 0 ? (
                        <p className="mt-1 font-body text-xs text-fog-dim">No members yet.</p>
                      ) : (
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {t.members.map((m, i) => (
                            <li key={i} className="font-body text-xs text-fog">
                              {m.name} <span className="text-fog-dim">({m.rollNumber})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                  {fFlat.length > 0 && (
                    <div className="border border-panel-line/60 bg-void px-3 py-2">
                      <ul className="flex flex-col gap-0.5">
                        {fFlat.map((r, i) => (
                          <li key={i} className="font-body text-xs text-fog">
                            {r.member.name} <span className="text-fog-dim">({r.member.rollNumber})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
