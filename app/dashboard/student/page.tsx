import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { events, factions } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const supabase = createAdminClient();
  const { data: dbFaction } = session.factionId
    ? await supabase.from("factions").select("slug, name").eq("id", session.factionId).maybeSingle()
    : { data: null };
  const faction = dbFaction ? (factions.find((f) => f.slug === dbFaction.slug) ?? null) : null;

  const { data: registrations } = await supabase
    .from("event_registrations")
    .select("event_slug")
    .eq("student_id", session.id);

  const myEvents = (registrations ?? [])
    .map((r) => events.find((e) => e.slug === r.event_slug))
    .filter((e): e is (typeof events)[number] => Boolean(e));

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-cyan text-glow-cyan">
            // Operative Terminal
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Welcome, {session.name}
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            Roll No. {session.rollNumber}
          </p>

          {faction && (
            <Link
              href={`/factions/${faction.slug}`}
              style={{ "--accent": faction.accent } as React.CSSProperties}
              className="border-glow-accent hover-glow-accent mt-6 flex items-center gap-4 border bg-panel/50 p-4 transition-transform hover:scale-[1.01]"
            >
              <div className="relative h-14 w-14 shrink-0">
                <Image src={faction.logo} alt={`${faction.name} emblem`} fill sizes="56px" className="object-contain" />
              </div>
              <div>
                <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Your Faction</p>
                <p className="text-glow-accent font-display text-lg font-bold uppercase">{faction.name}</p>
              </div>
            </Link>
          )}

          <div className="mt-8 border border-panel-line bg-panel/50 p-6">
            <p className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
              // Your Events ({myEvents.length})
            </p>

            {myEvents.length === 0 ? (
              <p className="mt-3 font-body text-sm text-fog">
                Nothing here yet — your faction head hasn&apos;t entered you
                into any events. Check back once registrations open.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {myEvents.map((e) => (
                  <Link
                    key={e.slug}
                    href={`/events/${e.slug}`}
                    className="flex items-center justify-between gap-3 border border-panel-line bg-void px-4 py-3 transition-colors hover:border-cyan"
                  >
                    <div>
                      <p className="font-display text-sm uppercase text-fog">{e.name}</p>
                      <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                        {e.category}
                      </p>
                    </div>
                    <span className="font-mono-fx text-xs text-fog-dim">
                      {e.pointsTier.label}
                      {e.pointsTier.points !== null ? ` — ${e.pointsTier.points}` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
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
