import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { events, posterFor } from "@/lib/data";
import { pointsForPlacement } from "@/lib/scoring";
import { getEventScheduleBlocks } from "@/lib/schedule";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PrintReportButton from "@/components/PrintReportButton";
import DocumentationReportForm from "@/components/DocumentationReportForm";

export default async function DocumentationDashboard() {
  const session = await getSession();
  if (!session || session.role !== "documentation") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const supabase = createAdminClient();

  const { data: resultRows } = await supabase
    .from("event_results")
    .select("event_slug, sub_event, status, first_faction_id, second_faction_id, third_faction_id");

  const { data: factionRows } = await supabase.from("factions").select("id, name");
  const factionNameById = new Map((factionRows ?? []).map((f) => [f.id, f.name]));

  const { data: registrationRows } = await supabase
    .from("event_registrations")
    .select("event_slug, students(name, roll_number)");
  type RegRow = { event_slug: string; students: { name: string; roll_number: string } | { name: string; roll_number: string }[] | null };
  const regs = (registrationRows ?? []) as unknown as RegRow[];
  const countByEvent = new Map<string, number>();
  const participantsByEvent = new Map<string, { name: string; rollNumber: string }[]>();
  for (const r of regs) {
    countByEvent.set(r.event_slug, (countByEvent.get(r.event_slug) ?? 0) + 1);
    const info = Array.isArray(r.students) ? r.students[0] : r.students;
    if (!info) continue;
    if (!participantsByEvent.has(r.event_slug)) participantsByEvent.set(r.event_slug, []);
    participantsByEvent.get(r.event_slug)!.push({ name: info.name, rollNumber: info.roll_number });
  }
  for (const list of participantsByEvent.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const { data: photoRows } = await supabase.from("event_photos").select("event_slug, storage_path, photo_type");
  const photosByEvent = new Map<string, { url: string; photoType: string }[]>();
  for (const p of photoRows ?? []) {
    const { data: pub } = supabase.storage.from("event-photos").getPublicUrl(p.storage_path);
    if (!photosByEvent.has(p.event_slug)) photosByEvent.set(p.event_slug, []);
    photosByEvent.get(p.event_slug)!.push({ url: pub.publicUrl, photoType: p.photo_type });
  }

  const { data: reportRows } = await supabase
    .from("event_reports")
    .select("event_slug, summary, objectives, outcome, feedback, web_url, highlights, issues, status, rejection_reason, updated_at");
  const reportByEvent = new Map((reportRows ?? []).map((r) => [r.event_slug, r]));

  // Most events have one event_results row; The Grid has two (BGMI + PES).
  const resultsByEvent = new Map<string, NonNullable<typeof resultRows>>();
  for (const r of resultRows ?? []) {
    if (!resultsByEvent.has(r.event_slug)) resultsByEvent.set(r.event_slug, []);
    resultsByEvent.get(r.event_slug)!.push(r);
  }

  const reports = events.map((e) => {
    const results = resultsByEvent.get(e.slug) ?? [];
    const closed = results.length > 0 && results.every((r) => r.status === "published");
    const placements = closed
      ? results.flatMap((result) => {
          const subLabel = e.subEvents?.find((se) => se.key === result.sub_event)?.label ?? null;
          return (
            [
              ["winner", result.first_faction_id],
              ["runner_up", result.second_faction_id],
              ["third", result.third_faction_id],
            ] as const
          )
            .filter(([, id]) => id)
            .map(([tier, id]) => ({
              tier,
              subLabel,
              faction: factionNameById.get(id as string) ?? "—",
              points: pointsForPlacement(e.slug, tier, result.sub_event),
            }));
        })
      : [];

    return {
      event: e,
      closed,
      participantCount: countByEvent.get(e.slug) ?? 0,
      participants: participantsByEvent.get(e.slug) ?? [],
      rounds: e.rounds,
      placements,
      report: reportByEvent.get(e.slug) ?? null,
      scheduleBlocks: getEventScheduleBlocks(e.slug),
      posterUrl: posterFor(e.slug),
      photos: photosByEvent.get(e.slug) ?? [],
    };
  });

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-4xl">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-yellow text-glow-yellow">
            // Documentation Terminal
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Welcome, {session.name}
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            Post-event reporting
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {reports.map((r) => (
              <div
                key={r.event.slug}
                className={`border p-6 ${r.closed ? "border-panel-line bg-panel/50" : "border-panel-line/50 bg-panel/20"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                      {r.event.category}
                    </p>
                    <h2 className="font-display text-lg font-bold uppercase text-fog">{r.event.name}</h2>
                  </div>
                  <span
                    className={`whitespace-nowrap font-mono-fx text-xs uppercase tracking-widest ${
                      r.closed ? "text-cyan" : "text-fog-dim"
                    }`}
                  >
                    {r.closed ? "Closed" : "Not Yet Closed"}
                  </span>
                </div>

                {!r.closed ? (
                  <p className="mt-4 font-body text-sm text-fog-dim">
                    Report unlocks once the control room publishes this
                    event's result.
                  </p>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <div>
                        <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                          Participants
                        </p>
                        <p className="mt-1 font-display text-lg text-fog">{r.participantCount}</p>
                      </div>
                      <div>
                        <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                          Rounds
                        </p>
                        <p className="mt-1 font-display text-lg text-fog">{r.rounds}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-1.5">
                      {r.placements.map((p, i) => (
                        <p key={`${p.subLabel ?? ""}-${p.tier}-${i}`} className="font-mono-fx text-xs text-fog">
                          <span className="text-fog-dim">
                            {p.subLabel && `${p.subLabel} — `}
                            {p.tier === "winner" ? "Winner" : p.tier === "runner_up" ? "Runner-Up" : "3rd"}
                          </span>{" "}
                          — {p.faction} (+{p.points})
                        </p>
                      ))}
                    </div>

                    <div className="mt-4">
                      <PrintReportButton />
                    </div>

                    <DocumentationReportForm
                      eventSlug={r.event.slug}
                      eventName={r.event.name}
                      existing={r.report}
                      scheduleBlocks={r.scheduleBlocks}
                      participants={r.participants}
                      posterUrl={r.posterUrl}
                      photos={r.photos}
                    />
                  </>
                )}
              </div>
            ))}
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
