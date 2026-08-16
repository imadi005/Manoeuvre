import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface StudentInfo {
  id: string;
  name: string;
  rollNumber: string;
  eventCount: number;
  eventSlugs: string[];
}

export interface Registration {
  id: string;
  studentId: string;
  name: string;
  rollNumber: string;
  isSubstitute: boolean;
}

export interface TeamData {
  id: string;
  name: string;
  subEventKey: string;
  members: Registration[];
}

export interface FactionRoster {
  students: StudentInfo[];
  registrationsByEvent: Record<string, Registration[]>;
  teamsByEvent: Record<string, TeamData[]>;
  totalRegistrations: number;
}

/** Shared by the faction-head overview page and each per-event detail page — one query set, sliced differently. */
export async function getFactionRoster(factionId: string): Promise<FactionRoster> {
  const supabase = createAdminClient();

  const { data: studentRows } = await supabase
    .from("students")
    .select("id, name, roll_number")
    .eq("faction_id", factionId)
    .order("name");

  const { data: registrationRows } = await supabase
    .from("event_registrations")
    .select("id, event_slug, student_id, team_id, is_substitute, students(name, roll_number)")
    .eq("faction_id", factionId);

  const { data: teamRows } = await supabase
    .from("event_teams")
    .select("id, event_slug, sub_event, name")
    .eq("faction_id", factionId);

  type RegRow = {
    id: string;
    event_slug: string;
    student_id: string;
    team_id: string | null;
    is_substitute: boolean;
    students: { name: string; roll_number: string } | { name: string; roll_number: string }[] | null;
  };
  const regs = (registrationRows ?? []) as unknown as RegRow[];

  const eventCountByStudent = new Map<string, number>();
  // Substitute registrations (gaming) are excluded here — they're exempt
  // from the schedule-conflict check, in both directions.
  const eventSlugsByStudent = new Map<string, string[]>();
  for (const r of regs) {
    eventCountByStudent.set(r.student_id, (eventCountByStudent.get(r.student_id) ?? 0) + 1);
    if (r.is_substitute) continue;
    if (!eventSlugsByStudent.has(r.student_id)) eventSlugsByStudent.set(r.student_id, []);
    eventSlugsByStudent.get(r.student_id)!.push(r.event_slug);
  }

  const students: StudentInfo[] = (studentRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    rollNumber: s.roll_number,
    eventCount: eventCountByStudent.get(s.id) ?? 0,
    eventSlugs: eventSlugsByStudent.get(s.id) ?? [],
  }));

  const registrationsByEvent: Record<string, Registration[]> = {};
  const membersByTeamId: Record<string, Registration[]> = {};
  for (const r of regs) {
    const info = Array.isArray(r.students) ? r.students[0] : r.students;
    const member: Registration = {
      id: r.id,
      studentId: r.student_id,
      name: info?.name ?? "—",
      rollNumber: info?.roll_number ?? "—",
      isSubstitute: r.is_substitute,
    };
    if (r.team_id) {
      if (!membersByTeamId[r.team_id]) membersByTeamId[r.team_id] = [];
      membersByTeamId[r.team_id].push(member);
    } else {
      if (!registrationsByEvent[r.event_slug]) registrationsByEvent[r.event_slug] = [];
      registrationsByEvent[r.event_slug].push(member);
    }
  }

  const teamsByEvent: Record<string, TeamData[]> = {};
  for (const t of teamRows ?? []) {
    if (!teamsByEvent[t.event_slug]) teamsByEvent[t.event_slug] = [];
    teamsByEvent[t.event_slug].push({
      id: t.id,
      name: t.name,
      subEventKey: t.sub_event,
      members: membersByTeamId[t.id] ?? [],
    });
  }

  return { students, registrationsByEvent, teamsByEvent, totalRegistrations: regs.length };
}
