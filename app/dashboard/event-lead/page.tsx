import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { events } from "@/lib/data";
import { getEventRoster, getEventProgress } from "@/lib/eventRoster";
import { getQuizState, getSubmissionCount, getEasterEggs } from "@/lib/quiz";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventWorkflowPanel from "@/components/EventWorkflowPanel";
import QuizControlPanel from "@/components/QuizControlPanel";

export default async function EventLeadDashboard() {
  const session = await getSession();
  if (!session || session.role !== "event_lead") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const event = events.find((e) => e.slug === session.detail);

  const supabase = createAdminClient();
  const { data: existingResults } = session.detail
    ? await supabase.from("event_results").select("sub_event, status").eq("event_slug", session.detail)
    : { data: [] };
  // Most events have one result row; The Grid has two (BGMI + PES).
  const resultStatusBySubEvent = new Map((existingResults ?? []).map((r) => [r.sub_event || "", r.status]));

  const { teams, individuals, roundResults, presentUnitIds, presentMemberStudentIds } = session.detail
    ? await getEventRoster(session.detail)
    : { teams: [], individuals: [], roundResults: {}, presentUnitIds: new Set<string>(), presentMemberStudentIds: new Set<string>() };

  const progress = session.detail ? await getEventProgress(session.detail) : { currentRound: 0, startedAt: null, completedAt: null };

  const isBlacktieProtocol = session.detail === "blacktie-protocol";
  const [quizState, quizSubmittedCount, quizEasterEggs] = isBlacktieProtocol
    ? await Promise.all([getQuizState("blacktie-protocol"), getSubmissionCount("blacktie-protocol"), getEasterEggs("blacktie-protocol")])
    : [null, 0, []];

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

          {isBlacktieProtocol && quizState && (
            <div className="mt-10">
              <QuizControlPanel
                startedAt={quizState.startedAt}
                closedAt={quizState.closedAt}
                submittedCount={quizSubmittedCount}
                totalRegistered={individuals.length}
                easterEggCount={quizEasterEggs.length}
              />
            </div>
          )}

          {event && (
            <div className="mt-10">
              <EventWorkflowPanel
                event={event}
                teams={teams}
                individuals={individuals}
                roundResults={roundResults}
                presentUnitIds={presentUnitIds}
                presentMemberStudentIds={presentMemberStudentIds}
                currentRound={progress.currentRound}
                completedAt={progress.completedAt}
                resultStatusBySubEvent={Object.fromEntries(resultStatusBySubEvent)}
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
