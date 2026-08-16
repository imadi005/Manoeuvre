import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getStarOfManoeuvreLeaderboard } from "@/lib/starOfManoeuvre";
import { DASHBOARD_BY_ROLE } from "@/lib/dashboardPath";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default async function StarOfManoeuvrePage() {
  const session = await getSession();
  if (!session || (session.role !== "control_room" && session.role !== "main_coordinator")) redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const leaderboard = await getStarOfManoeuvreLeaderboard();

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <Link
            href={DASHBOARD_BY_ROLE[session.role]}
            className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-cyan"
          >
            ← Back to Dashboard
          </Link>

          <p className="mt-4 font-mono-fx text-xs uppercase tracking-[0.4em] text-yellow text-glow-yellow">
            // Control Room & Coordinator Only
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Star of <span className="text-magenta text-glow-magenta">Manoeuvre</span>
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            Individual points across every event — Winner / Runner-up / 3rd / Participation, each credited in full to every team member. The Blacktie Protocol (IT Manager) doesn&apos;t count here.
          </p>

          <div className="mt-10">
            {leaderboard.length === 0 ? (
              <p className="font-body text-sm text-fog-dim">No individual points yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {leaderboard.map((s, i) => (
                  <div
                    key={s.studentId}
                    className={`flex items-center gap-4 border px-4 py-3 ${
                      i === 0 ? "border-yellow/60 bg-yellow/10" : "border-panel-line bg-panel/30"
                    }`}
                  >
                    <span className={`w-8 flex-shrink-0 text-center font-display text-xl font-black ${i === 0 ? "text-yellow" : "text-fog-dim"}`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold uppercase text-fog">{s.name}</p>
                      <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                        {s.rollNumber} · {s.factionName}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 font-display text-xl font-black ${i === 0 ? "text-yellow text-glow-yellow" : "text-fog"}`}>
                      {s.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
