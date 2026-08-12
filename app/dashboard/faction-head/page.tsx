import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFactionRoster } from "@/lib/factionRoster";
import { events, SLOTS_PER_FACTION, totalSlotsForEvent } from "@/lib/data";
import { logout } from "@/app/login/actions";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default async function FactionHeadDashboard() {
  const session = await getSession();
  if (!session || session.role !== "faction_head") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const supabase = createAdminClient();
  const { data: faction } = await supabase
    .from("factions")
    .select("name")
    .eq("id", session.factionId)
    .maybeSingle();

  const { students, registrationsByEvent, teamsByEvent, totalRegistrations } = await getFactionRoster(
    session.factionId
  );

  const unassignedCount = students.filter((s) => s.eventCount === 0).length;

  const eventProgress = events.map((event) => {
    const filled = event.teamConfig || event.subEvents
      ? (teamsByEvent[event.slug] ?? []).reduce((sum, t) => sum + t.members.length, 0)
      : (registrationsByEvent[event.slug] ?? []).length;
    return { event, filled, total: totalSlotsForEvent(event) };
  });

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-5xl">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-magenta text-glow-magenta">
            // Command Terminal
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Welcome, {session.name}
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            Faction: {faction?.name ?? "—"} · {students.length} operatives
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 border border-panel-line bg-panel/40 p-4">
            <p className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
              Faction slots used: <span className="text-fog">{totalRegistrations}</span> / {SLOTS_PER_FACTION}
            </p>
            <p className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
              Unassigned students:{" "}
              <span className={unassignedCount > 0 ? "text-magenta" : "text-fog"}>{unassignedCount}</span>
            </p>
          </div>

          <div className="mt-10">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Select an Event to Register Students
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {eventProgress.map(({ event, filled, total }) => {
                const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
                const full = filled >= total && total > 0;
                return (
                  <Link
                    key={event.slug}
                    href={`/dashboard/faction-head/${event.slug}`}
                    className="group border border-panel-line bg-panel/50 p-5 transition-colors hover:border-cyan/60 hover:bg-panel"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                          {event.category}
                        </p>
                        <h3 className="font-display text-lg font-bold uppercase text-fog transition-colors group-hover:text-cyan">
                          {event.name}
                        </h3>
                      </div>
                      <span
                        className={`whitespace-nowrap font-mono-fx text-xs ${full ? "text-cyan" : "text-fog-dim"}`}
                      >
                        {filled} / {total}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 w-full bg-void">
                      <div
                        className={`h-full ${full ? "bg-cyan" : "bg-yellow"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-3 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim transition-colors group-hover:text-fog">
                      Manage roster →
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>

          <form action={logout} className="mt-10">
            <button className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-magenta">
              Log out →
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
