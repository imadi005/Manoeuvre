import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { events } from "@/lib/data";
import { eventsConflict } from "@/lib/scheduleConflicts";
import { notifyReplacementNeeded } from "@/lib/notify";

function eventName(slug: string): string {
  return events.find((e) => e.slug === slug)?.name ?? slug;
}

/**
 * Shell for the "advances into a final, gets pulled from everything else"
 * workflow. Not yet wired to a UI trigger — the exact round names,
 * capacities, and which stage of which event should fire this are still
 * pending. Once that's decided, call this from the relevant action:
 *
 *   await withdrawFromOtherEvents(studentId, "blacktie-protocol", {
 *     reason: "advanced to The Blacktie Protocol — Final Round",
 *   });
 *
 * `onlyConflicting: true` withdraws just the events that time-clash with
 * `keepEventSlug` (schedule-driven). Leave it false (default) to withdraw
 * from every other event the student is in, e.g. for a marquee final round
 * that demands full commitment regardless of exact timing.
 */
export async function withdrawFromOtherEvents(
  studentId: string,
  keepEventSlug: string,
  options: { reason: string; onlyConflicting?: boolean }
): Promise<{ withdrawnFrom: string[] }> {
  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("name, faction_id, factions(name)")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { withdrawnFrom: [] };

  const factionRow = student.factions as unknown as { name: string } | { name: string }[] | null;
  const factionName = (Array.isArray(factionRow) ? factionRow[0]?.name : factionRow?.name) ?? "—";

  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id, event_slug")
    .eq("student_id", studentId)
    .neq("event_slug", keepEventSlug);

  const toWithdraw = (regs ?? []).filter(
    (r) => !options.onlyConflicting || eventsConflict(keepEventSlug, r.event_slug)
  );

  for (const r of toWithdraw) {
    const { error } = await supabase.from("event_registrations").delete().eq("id", r.id);
    if (error) continue;
    await notifyReplacementNeeded(r.event_slug, student.name, factionName, options.reason);
  }

  return { withdrawnFrom: toWithdraw.map((r) => r.event_slug) };
}

export { eventName };
