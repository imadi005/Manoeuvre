import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getQuizScorecard } from "@/lib/quiz";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const EVENT_SLUG = "blacktie-protocol";

export default async function QuizScorecardPage() {
  const session = await getSession();
  if (!session || session.role !== "event_lead" || session.detail !== EVENT_SLUG) redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const scorecard = await getQuizScorecard(EVENT_SLUG);

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <Link
            href="/dashboard/event-lead"
            className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-cyan"
          >
            ← Event Lead Terminal
          </Link>

          <p className="mt-4 font-mono-fx text-xs uppercase tracking-[0.4em] text-magenta text-glow-magenta">
            // IT Manager Quiz — Scorecard
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            {scorecard.length} Submission{scorecard.length === 1 ? "" : "s"}
          </h1>

          {scorecard.length === 0 ? (
            <p className="mt-8 font-body text-sm text-fog-dim">No submissions yet.</p>
          ) : (
            <div className="mt-8 overflow-x-auto border border-panel-line">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-panel-line bg-panel/50">
                    <th className="px-3 py-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Rank</th>
                    <th className="px-3 py-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Name</th>
                    <th className="px-3 py-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Roll No.</th>
                    <th className="px-3 py-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Faction</th>
                    <th className="px-3 py-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Score</th>
                    <th className="px-3 py-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecard.map((s, i) => (
                    <tr key={s.studentId} className="border-b border-panel-line/50 last:border-0 hover:bg-panel/30">
                      <td className="px-3 py-2 font-mono-fx text-sm text-fog-dim">{i + 1}</td>
                      <td className="px-3 py-2 font-body text-sm text-fog">{s.studentName}</td>
                      <td className="px-3 py-2 font-mono-fx text-xs text-fog-dim">{s.rollNumber}</td>
                      <td className="px-3 py-2 font-mono-fx text-xs text-fog-dim">{s.factionName}</td>
                      <td className="px-3 py-2 font-display text-base font-bold text-cyan text-glow-cyan">
                        {s.score}/{s.totalQuestions}
                      </td>
                      <td className="px-3 py-2 font-mono-fx text-[10px] text-fog-dim">
                        {new Date(s.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
