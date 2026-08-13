import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getRegistrationsOverview } from "@/lib/registrationsOverview";
import { events, totalSlotsForEvent } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default async function FactionDrilldownPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "main_coordinator") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const { slug } = await params;
  const { factions, teams, flatRegs } = await getRegistrationsOverview();
  const faction = factions.find((f) => f.slug === slug);
  if (!faction) notFound();

  const factionTeams = teams.filter((t) => t.factionId === faction.id);
  const factionFlat = flatRegs.filter((r) => r.factionId === faction.id);
  const totalPeople = factionTeams.reduce((s, t) => s + t.members.length, 0) + factionFlat.length;

  const rows = events
    .map((e) => {
      const eTeams = factionTeams.filter((t) => t.eventSlug === e.slug);
      const eFlat = factionFlat.filter((r) => r.eventSlug === e.slug);
      const filled = eTeams.reduce((s, t) => s + t.members.length, 0) + eFlat.length;
      return { event: e, teams: eTeams, flat: eFlat, filled };
    })
    .filter((r) => r.teams.length > 0 || r.flat.length > 0);

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
            // Faction Drilldown
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">{faction.name}</h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            {totalPeople} people registered across {rows.length} event{rows.length === 1 ? "" : "s"}
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {rows.length === 0 && (
              <p className="font-body text-sm text-fog-dim">Nothing registered yet for this faction.</p>
            )}
            {rows.map(({ event, teams: eTeams, flat: eFlat, filled }) => {
              const total = totalSlotsForEvent(event);
              return (
                <div key={event.slug} className="border border-panel-line bg-panel/40">
                  <div className="flex items-center justify-between border-b border-panel-line px-4 py-3">
                    <Link
                      href={`/dashboard/coordinator/registrations/event/${event.slug}`}
                      className="font-display text-sm font-bold uppercase text-fog transition-colors hover:text-cyan"
                    >
                      {event.name}
                    </Link>
                    <span className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
                      {filled}/{total} filled
                      {eTeams.length > 0 && ` · ${eTeams.length} team${eTeams.length === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 px-4 py-3">
                    {eTeams.map((t) => (
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
                    {eFlat.length > 0 && (
                      <div className="border border-panel-line/60 bg-void px-3 py-2">
                        <ul className="flex flex-col gap-0.5">
                          {eFlat.map((r, i) => (
                            <li key={i} className="font-body text-xs text-fog">
                              {r.member.name} <span className="text-fog-dim">({r.member.rollNumber})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
