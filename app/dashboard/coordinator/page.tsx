import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { events, factions as staticFactions } from "@/lib/data";
import { computeFactionTotals, computeParticipationTotals, mergeFactionTotals } from "@/lib/scoring";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ResultVerificationBoard from "@/components/ResultVerificationBoard";
import { facultyDecision } from "@/app/dashboard/faculty/actions";
import { publishResult } from "@/app/dashboard/control-room/actions";

export default async function CoordinatorDashboard() {
  const session = await getSession();
  if (!session || session.role !== "main_coordinator") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const supabase = createAdminClient();

  const { data: factionRows } = await supabase.from("factions").select("id, slug, name");
  const { data: studentRows } = await supabase.from("students").select("faction_id");
  const rosterByFaction = new Map<string, number>();
  for (const s of studentRows ?? []) {
    if (s.faction_id) rosterByFaction.set(s.faction_id, (rosterByFaction.get(s.faction_id) ?? 0) + 1);
  }

  const { data: allResults } = await supabase
    .from("event_results")
    .select(
      "id, event_slug, status, first_faction_id, second_faction_id, third_faction_id, notes, submitted_by, faculty_approved_by"
    );

  const { data: attendanceRows } = await supabase.from("event_attendance").select("event_slug, faction_id");

  const published = (allResults ?? []).filter((r) => r.status === "published");
  const totalsById = mergeFactionTotals(computeFactionTotals(published), computeParticipationTotals(attendanceRows ?? []));
  const idBySlug = new Map((factionRows ?? []).map((f) => [f.slug, f.id]));

  const standings = [...staticFactions]
    .map((f) => {
      const id = idBySlug.get(f.slug);
      return {
        faction: f,
        points: id ? (totalsById.get(id) ?? 0) : 0,
        roster: id ? (rosterByFaction.get(id) ?? 0) : 0,
      };
    })
    .sort((a, b) => b.points - a.points);

  const { data: registrationRows } = await supabase.from("event_registrations").select("event_slug");
  const regCountByEvent = new Map<string, number>();
  for (const r of registrationRows ?? []) {
    regCountByEvent.set(r.event_slug, (regCountByEvent.get(r.event_slug) ?? 0) + 1);
  }
  const resultByEvent = new Map((allResults ?? []).map((r) => [r.event_slug, r.status]));

  const { data: organizerRows } = await supabase.from("organizers").select("role");
  const orgCountByRole = new Map<string, number>();
  for (const o of organizerRows ?? []) {
    orgCountByRole.set(o.role, (orgCountByRole.get(o.role) ?? 0) + 1);
  }

  const factionNameById = new Map((factionRows ?? []).map((f) => [f.id, f.name]));

  const orgIds = [
    ...new Set((allResults ?? []).flatMap((r) => [r.submitted_by, r.faculty_approved_by]).filter(Boolean)),
  ];
  const { data: orgRows } = orgIds.length
    ? await supabase.from("organizers").select("id, name").in("id", orgIds)
    : { data: [] };
  const orgNameById = new Map((orgRows ?? []).map((o) => [o.id, o.name]));

  const toSummary = (r: NonNullable<typeof allResults>[number]) => ({
    id: r.id,
    eventName: events.find((e) => e.slug === r.event_slug)?.name ?? r.event_slug,
    first: r.first_faction_id ? (factionNameById.get(r.first_faction_id) ?? null) : null,
    second: r.second_faction_id ? (factionNameById.get(r.second_faction_id) ?? null) : null,
    third: r.third_faction_id ? (factionNameById.get(r.third_faction_id) ?? null) : null,
    notes: r.notes,
    submittedBy: (r.submitted_by ? orgNameById.get(r.submitted_by) : null) ?? "—",
    facultyApprovedBy: (r.faculty_approved_by ? orgNameById.get(r.faculty_approved_by) : null) ?? "—",
  });

  const awaitingFaculty = (allResults ?? []).filter((r) => r.status === "submitted").map(toSummary);
  const awaitingPublish = (allResults ?? [])
    .filter((r) => r.status === "faculty_approved")
    .map(toSummary)
    .map((r) => ({ ...r, submittedBy: r.facultyApprovedBy }));

  const { data: approvedReportRows } = await supabase
    .from("event_reports")
    .select("event_slug, summary, approved_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false });
  const approvedReports = (approvedReportRows ?? []).map((r) => ({
    eventName: events.find((e) => e.slug === r.event_slug)?.name ?? r.event_slug,
    slug: r.event_slug,
    summary: r.summary,
    approvedAt: r.approved_at,
  }));

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-5xl">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-yellow text-glow-yellow">
            // Main Coordinator Terminal
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Welcome, {session.name}
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            Full access — factions, events, scoring, certificates
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Students", value: (studentRows ?? []).length },
              { label: "Registrations", value: (registrationRows ?? []).length },
              { label: "Results Published", value: published.length },
              {
                label: "Organizers",
                value: (organizerRows ?? []).length,
              },
            ].map((s) => (
              <div key={s.label} className="border border-panel-line bg-panel/40 p-4 text-center">
                <p className="font-display text-2xl font-bold text-yellow text-glow-yellow">{s.value}</p>
                <p className="mt-1 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Faction Standings
            </p>
            <div className="flex flex-col gap-2">
              {standings.map((s, i) => (
                <div
                  key={s.faction.slug}
                  style={{ "--accent": s.faction.accent } as React.CSSProperties}
                  className="flex items-center gap-4 border border-panel-line bg-panel/30 px-4 py-2.5"
                >
                  <span className="w-6 font-display text-sm font-bold text-fog-dim">{i + 1}</span>
                  <span className="text-glow-accent flex-1 font-display text-sm font-bold uppercase">
                    {s.faction.name}
                  </span>
                  <span className="font-mono-fx text-xs text-fog-dim">{s.roster} students</span>
                  <span className="text-glow-accent font-display text-lg font-black">{s.points}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <Link
              href="/dashboard/coordinator/registrations"
              className="inline-block border border-cyan/60 px-4 py-2 font-mono-fx text-xs uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void"
            >
              // Full Registrations Overview — Every Faction × Every Event × Every Team →
            </Link>
          </div>

          <div className="mt-12">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Event Status
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {events.map((e) => {
                const status = resultByEvent.get(e.slug) ?? "no result";
                const statusColor =
                  status === "published"
                    ? "text-cyan"
                    : status === "submitted" || status === "faculty_approved" || status === "control_verified"
                      ? "text-yellow"
                      : status === "faculty_rejected" || status === "control_rejected"
                        ? "text-magenta"
                        : "text-fog-dim";
                return (
                  <div key={e.slug} className="flex items-center justify-between border border-panel-line bg-panel/30 px-4 py-2.5">
                    <span className="font-body text-sm text-fog">{e.name}</span>
                    <span className="font-mono-fx text-xs text-fog-dim">
                      {regCountByEvent.get(e.slug) ?? 0} reg.
                    </span>
                    <span className={`font-mono-fx text-[10px] uppercase tracking-widest ${statusColor}`}>
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-12">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Override — Awaiting Faculty
            </p>
            <ResultVerificationBoard
              pending={awaitingFaculty}
              decide={facultyDecision}
              approveLabel="Approve"
              rejectLabel="Send Back"
              askReasonOnReject
            />
          </div>

          <div className="mt-12">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Override — Awaiting Publish
            </p>
            <ResultVerificationBoard
              pending={awaitingPublish}
              decide={publishResult}
              approveLabel="Publish to Leaderboard & Close Event"
              rejectLabel="Send Back"
              submittedByLabel="Faculty-approved by"
              askReasonOnReject
            />
          </div>

          <div className="mt-12">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Approved Documentation
            </p>
            {approvedReports.length === 0 ? (
              <p className="font-body text-sm text-fog-dim">Nothing approved yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {approvedReports.map((r) => (
                  <div key={r.slug} className="border border-cyan/30 bg-panel/30 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-sm font-bold uppercase text-fog">{r.eventName}</span>
                      <span className="font-mono-fx text-[10px] uppercase tracking-widest text-cyan">Approved</span>
                    </div>
                    {r.summary && <p className="mt-1 line-clamp-2 font-body text-xs text-fog-dim">{r.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-12">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Organizer Directory
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {["main_coordinator", "event_lead", "faculty", "control_room", "documentation", "media", "committee"].map((role) => (
                <div key={role} className="border border-panel-line bg-panel/30 p-3 text-center">
                  <p className="font-display text-lg text-fog">{orgCountByRole.get(role) ?? 0}</p>
                  <p className="font-mono-fx text-[9px] uppercase tracking-widest text-fog-dim">
                    {role.replace("_", " ")}
                  </p>
                </div>
              ))}
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
