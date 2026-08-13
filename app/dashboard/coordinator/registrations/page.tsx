import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getRegistrationsOverview } from "@/lib/registrationsOverview";
import { createAdminClient } from "@/lib/supabase/admin";
import { events, totalSlotsForEvent } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default async function RegistrationsOverviewPage() {
  const session = await getSession();
  if (!session || session.role !== "main_coordinator") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const { factions, teams, flatRegs, totalRegistrations } = await getRegistrationsOverview();

  const supabase = createAdminClient();
  const { data: conflictRows, count: conflictCount } = await supabase
    .from("conflict_attempts")
    .select("attempted_event_slug, conflicting_event_slug, faction_id, created_at, students(name, roll_number)", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(20);

  type ConflictRow = {
    attempted_event_slug: string;
    conflicting_event_slug: string;
    faction_id: string;
    created_at: string;
    students: { name: string; roll_number: string } | { name: string; roll_number: string }[] | null;
  };
  const conflicts = (conflictRows ?? []) as unknown as ConflictRow[];
  const factionNameById = new Map(factions.map((f) => [f.id, f.name]));
  const eventName = (slug: string) => events.find((e) => e.slug === slug)?.name ?? slug;

  // Faction x Event matrix: filled count + team count per cell. Empty teams
  // (started but nobody added yet) are real, but clutter this view — hidden
  // here; still visible in the raw data, just not surfaced on this screen.
  const cell = (factionId: string, eventSlug: string) => {
    const event = events.find((e) => e.slug === eventSlug)!;
    if (event.teamConfig || event.subEvents) {
      const eventTeams = teams.filter((t) => t.factionId === factionId && t.eventSlug === eventSlug && t.members.length > 0);
      const filled = eventTeams.reduce((sum, t) => sum + t.members.length, 0);
      return { filled, teamCount: eventTeams.length, total: totalSlotsForEvent(event) };
    }
    const filled = flatRegs.filter((r) => r.factionId === factionId && r.eventSlug === eventSlug).length;
    return { filled, teamCount: 0, total: totalSlotsForEvent(event) };
  };

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-6xl">
          <Link
            href="/dashboard/coordinator"
            className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-cyan"
          >
            ← Coordinator Terminal
          </Link>

          <p className="mt-4 font-mono-fx text-xs uppercase tracking-[0.4em] text-yellow text-glow-yellow">
            // Registrations Overview
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Live Monitoring
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            {totalRegistrations} total registrations · read-only, updates as faction heads register
          </p>

          <div className="mt-8 border border-magenta/30 bg-panel/40 p-4">
            <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-magenta text-glow-magenta">
              // Schedule Conflicts Blocked
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-fog">
              {conflictCount ?? 0}
              <span className="ml-2 font-mono-fx text-xs font-normal uppercase tracking-widest text-fog-dim">
                attempts caught since this counter started tracking
              </span>
            </p>
            {conflicts.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {conflicts.map((c, i) => {
                  const s = Array.isArray(c.students) ? c.students[0] : c.students;
                  return (
                    <p key={i} className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                      {s ? `${s.name} (${s.roll_number})` : "—"} · {factionNameById.get(c.faction_id) ?? "—"} · tried{" "}
                      <span className="text-fog">{eventName(c.attempted_event_slug)}</span>, already in{" "}
                      <span className="text-fog">{eventName(c.conflicting_event_slug)}</span>
                    </p>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile: one card per faction, event rows spelled out in words — the
              wide matrix below is genuinely hard to read on a phone even with
              the sticky column working, since two different numbers (members
              filled vs. teams started, which are NOT the same thing — a team
              can exist with zero members) get crammed into one small cell. */}
          <div className="mt-10 flex flex-col gap-3 sm:hidden">
            {factions.map((f) => (
              <div key={f.id} className="border border-panel-line bg-panel/40 p-3">
                <p className="font-display text-sm font-bold uppercase text-fog">{f.name}</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {events.map((e) => {
                    const c = cell(f.id, e.slug);
                    if (c.filled === 0 && c.teamCount === 0) return null;
                    const full = c.filled >= c.total && c.total > 0;
                    return (
                      <div
                        key={e.slug}
                        className="flex items-center justify-between border-b border-panel-line/40 pb-1.5 last:border-b-0 last:pb-0"
                      >
                        <span className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">{e.name}</span>
                        <span className={`font-mono-fx text-[10px] uppercase tracking-widest ${full ? "text-cyan" : c.filled > 0 ? "text-yellow" : "text-fog-dim"}`}>
                          {c.filled}/{c.total} filled
                          {c.teamCount > 0 && ` · ${c.teamCount} team${c.teamCount === 1 ? "" : "s"}`}
                        </span>
                      </div>
                    );
                  })}
                  {events.every((e) => { const c = cell(f.id, e.slug); return c.filled === 0 && c.teamCount === 0; }) && (
                    <p className="font-body text-xs text-fog-dim">Nothing registered yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[900px] border-collapse font-mono-fx text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 border border-panel-line bg-void px-3 py-2 text-left uppercase tracking-widest text-fog-dim">
                    Faction
                  </th>
                  {events.map((e) => (
                    <th
                      key={e.slug}
                      className="border border-panel-line bg-panel/40 px-2 py-2 text-center uppercase tracking-widest text-fog-dim"
                    >
                      {e.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {factions.map((f) => (
                  <tr key={f.id}>
                    <td className="sticky left-0 border border-panel-line bg-void px-3 py-2 font-body font-semibold uppercase text-fog">
                      {f.name}
                    </td>
                    {events.map((e) => {
                      const c = cell(f.id, e.slug);
                      const full = c.filled >= c.total && c.total > 0;
                      return (
                        <td
                          key={e.slug}
                          className={`border border-panel-line px-2 py-2 text-center ${full ? "bg-cyan/10 text-cyan" : c.filled > 0 ? "text-yellow" : "text-fog-dim"}`}
                        >
                          {c.filled}/{c.total}
                          {c.teamCount > 0 && <div className="text-[9px] opacity-70">{c.teamCount} team{c.teamCount === 1 ? "" : "s"}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
              Teams with nobody added yet aren&apos;t shown here — a team only counts once it has at least one member.
            </p>
          </div>

          <div className="mt-12">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Full Detail — Every Team &amp; Every Member
            </p>
            <div className="flex flex-col gap-3">
              {factions.map((f) => {
                const factionTeams = teams.filter((t) => t.factionId === f.id && t.members.length > 0);
                const factionFlat = flatRegs.filter((r) => r.factionId === f.id);
                if (factionTeams.length === 0 && factionFlat.length === 0) return null;

                const byEvent = new Map<string, { teams: typeof factionTeams; flat: typeof factionFlat }>();
                for (const t of factionTeams) {
                  if (!byEvent.has(t.eventSlug)) byEvent.set(t.eventSlug, { teams: [], flat: [] });
                  byEvent.get(t.eventSlug)!.teams.push(t);
                }
                for (const r of factionFlat) {
                  if (!byEvent.has(r.eventSlug)) byEvent.set(r.eventSlug, { teams: [], flat: [] });
                  byEvent.get(r.eventSlug)!.flat.push(r);
                }

                return (
                  <details key={f.id} className="border border-panel-line bg-panel/40 open:bg-panel/60">
                    <summary className="cursor-pointer px-4 py-3 font-display text-sm font-bold uppercase tracking-wide text-fog">
                      {f.name}
                      <span className="ml-3 font-mono-fx text-xs font-normal normal-case text-fog-dim">
                        {factionTeams.reduce((s, t) => s + t.members.length, 0) + factionFlat.length} registered across {byEvent.size} event{byEvent.size === 1 ? "" : "s"}
                      </span>
                    </summary>
                    <div className="border-t border-panel-line px-4 py-4">
                      {[...byEvent.entries()].map(([slug, group]) => (
                        <div key={slug} className="mb-5 last:mb-0">
                          <p className="mb-2 font-mono-fx text-[11px] uppercase tracking-widest text-cyan">
                            {events.find((e) => e.slug === slug)?.name ?? slug}
                          </p>
                          {group.teams.map((t) => (
                            <div key={t.id} className="mb-2 border border-panel-line/60 bg-void px-3 py-2">
                              <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">{t.name}</p>
                              <p className="mt-1 font-body text-xs text-fog">
                                {t.members.length === 0
                                  ? "No members yet."
                                  : t.members.map((m) => `${m.name} (${m.rollNumber})`).join(", ")}
                              </p>
                            </div>
                          ))}
                          {group.flat.length > 0 && (
                            <div className="border border-panel-line/60 bg-void px-3 py-2">
                              <p className="font-body text-xs text-fog">
                                {group.flat.map((r) => `${r.member.name} (${r.member.rollNumber})`).join(", ")}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
              {teams.length === 0 && flatRegs.length === 0 && (
                <p className="font-body text-sm text-fog-dim">No registrations yet.</p>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
