import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pointsForPlacement, type PlacementTier } from "@/lib/scoring";

// The Blacktie Protocol ("IT Manager") explicitly doesn't count toward
// individual Star of Manoeuvre points, even though it counts for the
// faction leaderboard.
const EXCLUDED_EVENT_SLUG = "blacktie-protocol";

export interface StudentPoints {
  studentId: string;
  name: string;
  rollNumber: string;
  factionName: string;
  points: number;
}

/**
 * Individual student leaderboard: every member of a team that earns
 * Participation, Winner, Runner-up, or 3rd points gets the FULL point
 * value credited to them personally (not divided across the team).
 * Participation counts immediately (same as the faction leaderboard);
 * placement points only count once the event's result is published.
 */
export async function getStarOfManoeuvreLeaderboard(): Promise<StudentPoints[]> {
  const supabase = createAdminClient();

  const { data: studentRows } = await supabase.from("students").select("id, name, roll_number, faction_id");
  const { data: factionRows } = await supabase.from("factions").select("id, name");
  const factionNameById = new Map((factionRows ?? []).map((f) => [f.id, f.name]));

  const pointsByStudent = new Map<string, number>();
  const add = (studentId: string, points: number) => {
    if (points === 0) return;
    pointsByStudent.set(studentId, (pointsByStudent.get(studentId) ?? 0) + points);
  };

  // Team -> member student ids, needed to expand both attendance and placement credit to individuals.
  const { data: regRows } = await supabase.from("event_registrations").select("student_id, team_id, event_slug");
  const membersByTeamId = new Map<string, string[]>();
  for (const r of regRows ?? []) {
    if (!r.team_id) continue;
    if (!membersByTeamId.has(r.team_id)) membersByTeamId.set(r.team_id, []);
    membersByTeamId.get(r.team_id)!.push(r.student_id);
  }

  // 1. Participation -- immediate, same trigger as the faction leaderboard.
  const { data: attendanceRows } = await supabase
    .from("event_attendance")
    .select("event_slug, team_id, student_id, sub_event")
    .neq("event_slug", EXCLUDED_EVENT_SLUG);

  for (const a of attendanceRows ?? []) {
    const points = pointsForPlacement(a.event_slug, "participation", a.sub_event);
    if (points === 0) continue;
    const memberIds = a.team_id ? (membersByTeamId.get(a.team_id) ?? []) : a.student_id ? [a.student_id] : [];
    for (const studentId of memberIds) add(studentId, points);
  }

  // 2. Placement (Winner/Runner-up/3rd) -- only once the event's result is published,
  // same gate as the faction leaderboard. event_results only stores the winning
  // FACTION, not the specific team, so the winning team/student comes from the
  // final round's event_round_results instead.
  const { data: publishedResults } = await supabase
    .from("event_results")
    .select("event_slug, sub_event")
    .eq("status", "published")
    .neq("event_slug", EXCLUDED_EVENT_SLUG);
  const publishedKeys = new Set((publishedResults ?? []).map((r) => `${r.event_slug}::${r.sub_event ?? ""}`));

  const { data: roundResultRows } = await supabase
    .from("event_round_results")
    .select("event_slug, round_number, team_id, student_id, status")
    .in("status", ["winner", "runner_up", "third"])
    .neq("event_slug", EXCLUDED_EVENT_SLUG);

  // Need each row's sub_event (carried on the team, not the round result) and whether its round is the event's final round.
  const eventsModule = await import("@/lib/data");
  const roundsBySlug = new Map(eventsModule.events.map((e) => [e.slug, e.rounds]));
  const { data: teamSubEventRows } = await supabase.from("event_teams").select("id, sub_event");
  const subEventByTeamId = new Map((teamSubEventRows ?? []).map((t) => [t.id, t.sub_event ?? ""]));

  for (const r of roundResultRows ?? []) {
    if (r.round_number !== roundsBySlug.get(r.event_slug)) continue; // only the final round counts as a placement
    const subEvent = r.team_id ? (subEventByTeamId.get(r.team_id) ?? "") : "";
    if (!publishedKeys.has(`${r.event_slug}::${subEvent}`)) continue; // not published yet -- doesn't count

    const points = pointsForPlacement(r.event_slug, r.status as PlacementTier, subEvent);
    if (points === 0) continue;
    const memberIds = r.team_id ? (membersByTeamId.get(r.team_id) ?? []) : r.student_id ? [r.student_id] : [];
    for (const studentId of memberIds) add(studentId, points);
  }

  const leaderboard: StudentPoints[] = (studentRows ?? [])
    .map((s) => ({
      studentId: s.id,
      name: s.name,
      rollNumber: s.roll_number,
      factionName: s.faction_id ? (factionNameById.get(s.faction_id) ?? "—") : "—",
      points: pointsByStudent.get(s.id) ?? 0,
    }))
    .filter((s) => s.points > 0)
    .sort((a, b) => b.points - a.points);

  return leaderboard;
}
