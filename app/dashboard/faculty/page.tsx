import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { events } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ResultVerificationBoard from "@/components/ResultVerificationBoard";
import DocumentationApprovalBoard from "@/components/DocumentationApprovalBoard";
import { facultyDecision, documentationDecision } from "./actions";

export default async function FacultyDashboard() {
  const session = await getSession();
  if (!session || session.role !== "faculty") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const event = events.find((e) => e.slug === session.detail);

  const supabase = createAdminClient();
  const { data: resultRows } = session.detail
    ? await supabase
        .from("event_results")
        .select("id, event_slug, sub_event, first_faction_id, second_faction_id, third_faction_id, notes, submitted_by")
        .eq("event_slug", session.detail)
        .eq("status", "submitted")
    : { data: [] };

  const { data: factionRows } = await supabase.from("factions").select("id, name");
  const factionNameById = new Map((factionRows ?? []).map((f) => [f.id, f.name]));

  const submitterIds = [...new Set((resultRows ?? []).map((r) => r.submitted_by).filter(Boolean))];
  const { data: submitterRows } = submitterIds.length
    ? await supabase.from("organizers").select("id, name").in("id", submitterIds)
    : { data: [] };
  const submitterNameById = new Map((submitterRows ?? []).map((o) => [o.id, o.name]));

  const pending = (resultRows ?? []).map((r) => ({
    id: r.id,
    eventName: (() => {
      const subLabel = event?.subEvents?.find((se) => se.key === r.sub_event)?.label;
      return `${event?.name ?? r.event_slug}${subLabel ? ` — ${subLabel}` : ""}`;
    })(),
    first: r.first_faction_id ? (factionNameById.get(r.first_faction_id) ?? null) : null,
    second: r.second_faction_id ? (factionNameById.get(r.second_faction_id) ?? null) : null,
    third: r.third_faction_id ? (factionNameById.get(r.third_faction_id) ?? null) : null,
    notes: r.notes,
    submittedBy: (r.submitted_by ? submitterNameById.get(r.submitted_by) : null) ?? "—",
  }));

  const { data: reportRows } = session.detail
    ? await supabase
        .from("event_reports")
        .select("id, event_slug, summary, objectives, outcome, feedback, web_url, written_by")
        .eq("event_slug", session.detail)
        .eq("status", "submitted")
    : { data: [] };

  const writerIds = [...new Set((reportRows ?? []).map((r) => r.written_by).filter(Boolean))];
  const { data: writerRows } = writerIds.length
    ? await supabase.from("organizers").select("id, name").in("id", writerIds)
    : { data: [] };
  const writerNameById = new Map((writerRows ?? []).map((o) => [o.id, o.name]));

  const pendingReports = (reportRows ?? []).map((r) => ({
    id: r.id,
    eventName: events.find((e) => e.slug === r.event_slug)?.name ?? r.event_slug,
    summary: r.summary,
    objectives: r.objectives,
    outcome: r.outcome,
    feedback: r.feedback,
    webUrl: r.web_url,
    writtenBy: (r.written_by ? writerNameById.get(r.written_by) : null) ?? "—",
  }));

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-yellow text-glow-yellow">
            // Faculty Terminal
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Welcome, {session.name}
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            Faculty in charge — {event?.name ?? session.detail ?? "—"}
          </p>

          <div className="mt-10">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Awaiting Your Approval
            </p>
            <ResultVerificationBoard
              pending={pending}
              decide={facultyDecision}
              approveLabel="Approve"
              rejectLabel="Send Back"
              askReasonOnReject
            />
          </div>

          <div className="mt-12">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Documentation Awaiting Your Approval
            </p>
            <DocumentationApprovalBoard pending={pendingReports} decide={documentationDecision} />
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
