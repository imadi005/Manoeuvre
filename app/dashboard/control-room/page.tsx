import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { events } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ResultVerificationBoard from "@/components/ResultVerificationBoard";
import { publishResult } from "./actions";

export default async function ControlRoomDashboard() {
  const session = await getSession();
  if (!session || session.role !== "control_room") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const supabase = createAdminClient();

  const { data: resultRows } = await supabase
    .from("event_results")
    .select(
      "id, event_slug, status, first_faction_id, second_faction_id, third_faction_id, notes, submitted_by, faculty_approved_by"
    )
    .eq("status", "faculty_approved");

  const { data: factionRows } = await supabase.from("factions").select("id, name");
  const factionNameById = new Map((factionRows ?? []).map((f) => [f.id, f.name]));

  const orgIds = [
    ...new Set((resultRows ?? []).flatMap((r) => [r.submitted_by, r.faculty_approved_by]).filter(Boolean)),
  ];
  const { data: orgRows } = orgIds.length
    ? await supabase.from("organizers").select("id, name").in("id", orgIds)
    : { data: [] };
  const orgNameById = new Map((orgRows ?? []).map((o) => [o.id, o.name]));

  const toSummary = (r: NonNullable<typeof resultRows>[number]) => ({
    id: r.id,
    eventName: events.find((e) => e.slug === r.event_slug)?.name ?? r.event_slug,
    first: r.first_faction_id ? (factionNameById.get(r.first_faction_id) ?? null) : null,
    second: r.second_faction_id ? (factionNameById.get(r.second_faction_id) ?? null) : null,
    third: r.third_faction_id ? (factionNameById.get(r.third_faction_id) ?? null) : null,
    notes: r.notes,
    submittedBy: (r.submitted_by ? orgNameById.get(r.submitted_by) : null) ?? "—",
    facultyApprovedBy: (r.faculty_approved_by ? orgNameById.get(r.faculty_approved_by) : null) ?? "—",
  });

  const publishQueue = (resultRows ?? [])
    .map(toSummary)
    .map((r) => ({ ...r, submittedBy: r.facultyApprovedBy }));

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-magenta text-glow-magenta">
            // Control Room Terminal
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Welcome, {session.name}
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            Awaiting publish — one click sends it live on the leaderboard
          </p>

          <div className="mt-10">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Awaiting Publish
            </p>
            <ResultVerificationBoard
              pending={publishQueue}
              decide={publishResult}
              approveLabel="Publish to Leaderboard & Close Event"
              rejectLabel="Send Back"
              submittedByLabel="Faculty-approved by"
              askReasonOnReject
            />
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
