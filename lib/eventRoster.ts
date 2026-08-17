import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RosterMember {
  id: string;
  studentId: string;
  name: string;
  rollNumber: string;
  isSubstitute: boolean;
}

export interface RosterTeam {
  id: string;
  name: string;
  factionName: string;
  subEventKey: string;
  members: RosterMember[];
}

export interface RosterIndividual {
  registrationId: string;
  studentId: string;
  name: string;
  rollNumber: string;
  factionName: string;
}

export type RoundStatus = "advanced" | "eliminated" | "winner" | "runner_up" | "third";

/** unitId -> status, per round number. unitId is a team id for team events, a student id for flat events. */
export type RoundResultsByRound = Record<number, Record<string, RoundStatus>>;

export interface EventProgress {
  currentRound: number;
  startedAt: string | null;
  completedAt: string | null;
}

/** Attendance/round-progress state for one event — 0 = not started yet (attendance phase). */
export async function getEventProgress(eventSlug: string): Promise<EventProgress> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("event_progress")
    .select("current_round, started_at, completed_at")
    .eq("event_slug", eventSlug)
    .maybeSingle();
  return {
    currentRound: data?.current_round ?? 0,
    startedAt: data?.started_at ?? null,
    completedAt: data?.completed_at ?? null,
  };
}

/** Full cross-faction roster for one event — every registered team (or individual, for flat events) across all 8 factions. Used by the event lead's round-progress entry and the public event page's display. */
export async function getEventRoster(eventSlug: string): Promise<{
  teams: RosterTeam[];
  individuals: RosterIndividual[];
  roundResults: RoundResultsByRound;
  presentUnitIds: Set<string>;
  presentMemberStudentIds: Set<string>;
}> {
  const supabase = createAdminClient();

  const { data: factionRows } = await supabase.from("factions").select("id, name");
  const factionNameById = new Map((factionRows ?? []).map((f) => [f.id, f.name]));

  const { data: teamRows } = await supabase
    .from("event_teams")
    .select("id, name, sub_event, faction_id")
    .eq("event_slug", eventSlug)
    .order("name");

  const { data: regRows } = await supabase
    .from("event_registrations")
    .select("id, student_id, team_id, faction_id, is_substitute, students(name, roll_number)")
    .eq("event_slug", eventSlug);

  type RegRow = {
    id: string;
    student_id: string;
    team_id: string | null;
    faction_id: string;
    is_substitute: boolean;
    students: { name: string; roll_number: string } | { name: string; roll_number: string }[] | null;
  };
  const regs = (regRows ?? []) as unknown as RegRow[];

  const membersByTeamId = new Map<string, RosterMember[]>();
  const individuals: RosterIndividual[] = [];
  for (const r of regs) {
    const info = Array.isArray(r.students) ? r.students[0] : r.students;
    if (r.team_id) {
      if (!membersByTeamId.has(r.team_id)) membersByTeamId.set(r.team_id, []);
      membersByTeamId.get(r.team_id)!.push({
        id: r.id,
        studentId: r.student_id,
        name: info?.name ?? "—",
        rollNumber: info?.roll_number ?? "—",
        isSubstitute: r.is_substitute,
      });
    } else {
      individuals.push({
        registrationId: r.id,
        studentId: r.student_id,
        name: info?.name ?? "—",
        rollNumber: info?.roll_number ?? "—",
        factionName: factionNameById.get(r.faction_id) ?? "—",
      });
    }
  }

  const teams: RosterTeam[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    factionName: factionNameById.get(t.faction_id) ?? "—",
    subEventKey: t.sub_event,
    members: membersByTeamId.get(t.id) ?? [],
  }));

  const { data: roundRows } = await supabase
    .from("event_round_results")
    .select("round_number, team_id, student_id, status")
    .eq("event_slug", eventSlug);

  const roundResults: RoundResultsByRound = {};
  for (const r of roundRows ?? []) {
    const unitId = r.team_id ?? r.student_id;
    if (!unitId) continue;
    if (!roundResults[r.round_number]) roundResults[r.round_number] = {};
    roundResults[r.round_number][unitId] = r.status as RoundStatus;
  }

  const { data: attendanceRows } = await supabase
    .from("event_attendance")
    .select("team_id, student_id")
    .eq("event_slug", eventSlug);
  const presentUnitIds = new Set<string>();
  for (const a of attendanceRows ?? []) {
    const unitId = a.team_id ?? a.student_id;
    if (unitId) presentUnitIds.add(unitId);
  }

  // The Grid only: per-member presence within a squad, purely informational.
  const { data: memberAttendanceRows } = await supabase
    .from("event_member_attendance")
    .select("student_id")
    .eq("event_slug", eventSlug);
  const presentMemberStudentIds = new Set((memberAttendanceRows ?? []).map((r) => r.student_id));

  return { teams, individuals, roundResults, presentUnitIds, presentMemberStudentIds };
}
