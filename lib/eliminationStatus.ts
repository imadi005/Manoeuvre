import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type RegRow = { event_slug: string; team_id: string | null; is_substitute: boolean };

/**
 * Which of a student's registrations still count for schedule-conflict
 * checks. Excludes substitute registrations (existing rule) AND any
 * registration where the student's unit has already been eliminated --
 * once a team/individual is out of an event, that slot no longer blocks
 * them from joining something else that overlaps its schedule.
 */
export async function activeConflictSlugs(studentId: string, regs: RegRow[]): Promise<string[]> {
  const candidates = regs.filter((r) => !r.is_substitute);
  if (candidates.length === 0) return [];

  const supabase = createAdminClient();

  const teamIds = candidates.map((r) => r.team_id).filter((v): v is string => !!v);
  const flatSlugs = candidates.filter((r) => !r.team_id).map((r) => r.event_slug);

  const eliminatedTeamIds = new Set<string>();
  if (teamIds.length > 0) {
    const { data } = await supabase
      .from("event_round_results")
      .select("team_id")
      .eq("status", "eliminated")
      .in("team_id", teamIds);
    for (const r of data ?? []) if (r.team_id) eliminatedTeamIds.add(r.team_id);
  }

  const eliminatedFlatSlugs = new Set<string>();
  if (flatSlugs.length > 0) {
    const { data } = await supabase
      .from("event_round_results")
      .select("event_slug")
      .eq("status", "eliminated")
      .eq("student_id", studentId)
      .is("team_id", null)
      .in("event_slug", flatSlugs);
    for (const r of data ?? []) eliminatedFlatSlugs.add(r.event_slug);
  }

  return candidates
    .filter((r) => (r.team_id ? !eliminatedTeamIds.has(r.team_id) : !eliminatedFlatSlugs.has(r.event_slug)))
    .map((r) => r.event_slug);
}

/**
 * Batched version for a whole faction roster at once -- same exclusion
 * rule, but computed for every student in one pass instead of one query
 * set per student. Used to keep the faction-head UI's conflict badges
 * consistent with what addRegistration will actually enforce.
 */
export async function activeConflictSlugsByStudent(
  regs: { studentId: string; eventSlug: string; teamId: string | null; isSubstitute: boolean }[]
): Promise<Map<string, string[]>> {
  const candidates = regs.filter((r) => !r.isSubstitute);
  const supabase = createAdminClient();

  const teamIds = [...new Set(candidates.map((r) => r.teamId).filter((v): v is string => !!v))];
  const eliminatedTeamIds = new Set<string>();
  if (teamIds.length > 0) {
    const { data } = await supabase
      .from("event_round_results")
      .select("team_id")
      .eq("status", "eliminated")
      .in("team_id", teamIds);
    for (const r of data ?? []) if (r.team_id) eliminatedTeamIds.add(r.team_id);
  }

  const flatCandidates = candidates.filter((r) => !r.teamId);
  const eliminatedFlat = new Set<string>();
  if (flatCandidates.length > 0) {
    const studentIds = [...new Set(flatCandidates.map((r) => r.studentId))];
    const { data } = await supabase
      .from("event_round_results")
      .select("event_slug, student_id")
      .eq("status", "eliminated")
      .is("team_id", null)
      .in("student_id", studentIds);
    for (const r of data ?? []) if (r.student_id) eliminatedFlat.add(`${r.student_id}:${r.event_slug}`);
  }

  const bySlug = new Map<string, string[]>();
  for (const r of candidates) {
    const eliminated = r.teamId ? eliminatedTeamIds.has(r.teamId) : eliminatedFlat.has(`${r.studentId}:${r.eventSlug}`);
    if (eliminated) continue;
    if (!bySlug.has(r.studentId)) bySlug.set(r.studentId, []);
    bySlug.get(r.studentId)!.push(r.eventSlug);
  }
  return bySlug;
}
