import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuizState, getQuizQuestions, getStudentAnswers, getStudentSubmission, getEasterEggs, isMarkedPresent } from "@/lib/quiz";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import QuizRunner from "@/components/QuizRunner";

const EVENT_SLUG = "blacktie-protocol";

export default async function BlacktieQuizPage() {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const supabase = createAdminClient();
  const { data: reg } = await supabase
    .from("event_registrations")
    .select("id")
    .eq("student_id", session.id)
    .eq("event_slug", EVENT_SLUG)
    .maybeSingle();

  if (!reg) {
    return (
      <>
        <Navbar />
        <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
          <div className="grid-bg pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-xl text-center">
            <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-magenta text-glow-magenta">// Access Denied</p>
            <h1 className="font-display mt-3 text-2xl font-bold uppercase text-fog">
              You&apos;re not registered for The Blacktie Protocol.
            </h1>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const [state, questions, answers, submission, easterEggs, present] = await Promise.all([
    getQuizState(EVENT_SLUG),
    getQuizQuestions(EVENT_SLUG, session.id),
    getStudentAnswers(EVENT_SLUG, session.id),
    getStudentSubmission(EVENT_SLUG, session.id),
    getEasterEggs(EVENT_SLUG),
    isMarkedPresent(EVENT_SLUG, session.id),
  ]);

  if (!present && !submission) {
    return (
      <>
        <Navbar />
        <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
          <div className="grid-bg pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-xl text-center">
            <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-yellow text-glow-yellow">// Attendance Pending</p>
            <h1 className="font-display mt-3 text-2xl font-bold uppercase text-fog">
              Wait for your event lead to mark you present.
            </h1>
            <p className="mt-3 font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
              The quiz opens up right after attendance — check back once you've been marked in.
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-magenta text-glow-magenta">
            // The Blacktie Protocol — Round 1
          </p>
          <h1 className="font-display mt-2 text-2xl font-bold uppercase text-fog sm:text-3xl">
            IT Manager Screening Quiz
          </h1>

          <div className="mt-8">
            <QuizRunner
              questions={questions}
              initialAnswers={answers}
              initialStartedAt={state.startedAt}
              initialDurationMinutes={state.durationMinutes}
              initialClosedAt={state.closedAt}
              alreadySubmitted={!!submission}
              easterEggs={easterEggs}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
