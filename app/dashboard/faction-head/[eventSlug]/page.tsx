import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getFactionRoster } from "@/lib/factionRoster";
import { events, totalSlotsForEvent } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventRegistrationPanel from "@/components/EventRegistrationPanel";

export default async function FactionHeadEventPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const session = await getSession();
  if (!session || session.role !== "faction_head") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const event = events.find((e) => e.slug === eventSlug);
  if (!event) notFound();

  const { students, registrationsByEvent, teamsByEvent } = await getFactionRoster(session.factionId);

  const filled = event.teamConfig || event.subEvents
    ? (teamsByEvent[event.slug] ?? []).reduce((sum, t) => sum + t.members.length, 0)
    : (registrationsByEvent[event.slug] ?? []).length;
  const total = totalSlotsForEvent(event);

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-4xl">
          <Link
            href="/dashboard/faction-head"
            className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-cyan"
          >
            ← All Events
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-cyan text-glow-cyan">
                {event.category}
              </p>
              <h1 className="font-display mt-1 text-3xl font-bold uppercase text-fog sm:text-4xl">
                {event.name}
              </h1>
              <p className="mt-2 font-body text-sm text-fog-dim">{event.tagline}</p>
            </div>
            <div className="border border-panel-line bg-panel/40 px-4 py-3 text-center">
              <p className="font-display text-2xl font-bold text-yellow text-glow-yellow">
                {filled} / {total}
              </p>
              <p className="mt-1 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                Slots Filled
              </p>
            </div>
          </div>

          <div className="mt-10">
            <EventRegistrationPanel
              event={event}
              students={students}
              registrations={registrationsByEvent[event.slug] ?? []}
              teams={teamsByEvent[event.slug] ?? []}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
