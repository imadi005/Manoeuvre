import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { events } from "@/lib/data";
import { getEventRoster } from "@/lib/eventRoster";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventResultForm from "@/components/EventResultForm";
import RoundProgressPanel from "@/components/RoundProgressPanel";

export default async function EventLeadDashboard() {
  const session = await getSession();
  if (!session || session.role !== "event_lead") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const event = events.find((e) => e.slug === session.detail);

  const supabase = createAdminClient();
  const { data: factionRows } = await supabase.from("factions").select("id, name").order("name");
  const { data: existing } = session.detail
    ? await supabase
        .from("event_results")
        .select("status, first_faction_id, second_faction_id, third_faction_id, fourth_faction_id, notes, rejection_reason")
        .eq("event_slug", session.detail)
        .maybeSingle()
    : { data: null };

  const { teams, individuals, roundResults } = session.detail
    ? await getEventRoster(session.detail)
    : { teams: [], individuals: [], roundResults: {} };

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-cyan text-glow-cyan">
            // Event Lead Terminal
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Welcome, {session.name}
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            Leading: {event?.name ?? session.detail ?? "—"}
          </p>

          <div className="mt-10">
            <EventResultForm factions={factionRows ?? []} existing={existing} />
          </div>

          {event && (
            <div className="mt-12">
              <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
                // Round Progress
              </p>
              <RoundProgressPanel
                totalRounds={event.rounds}
                teams={teams}
                individuals={individuals}
                roundResults={roundResults}
              />
            </div>
          )}

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
