import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface OverviewMember {
  name: string;
  rollNumber: string;
}

export interface OverviewTeam {
  id: string;
  name: string;
  eventSlug: string;
  factionId: string;
  subEventKey: string;
  members: OverviewMember[];
}

export interface OverviewFlatReg {
  eventSlug: string;
  factionId: string;
  member: OverviewMember;
}

export interface RegistrationsOverview {
  factions: { id: string; name: string; slug: string }[];
  teams: OverviewTeam[];
  flatRegs: OverviewFlatReg[];
  totalRegistrations: number;
}

/** Cross-faction, cross-event read-only snapshot for the main coordinator's monitoring view. Pure reads — no writes anywhere in this module. */
export async function getRegistrationsOverview(): Promise<RegistrationsOverview> {
  const supabase = createAdminClient();

  const { data: factions } = await supabase.from("factions").select("id, name, slug").order("name");
  const { data: teamRows } = await supabase.from("event_teams").select("id, name, event_slug, faction_id, sub_event");
  const { data: regRows } = await supabase
    .from("event_registrations")
    .select("event_slug, faction_id, team_id, students(name, roll_number)");

  type StudentRow = { name: string; roll_number: string };
  type RegRow = {
    event_slug: string;
    faction_id: string;
    team_id: string | null;
    students: StudentRow | StudentRow[] | null;
  };
  const regs = (regRows ?? []) as unknown as RegRow[];

  const membersByTeamId = new Map<string, OverviewMember[]>();
  const flatRegs: OverviewFlatReg[] = [];

  for (const r of regs) {
    const info = Array.isArray(r.students) ? r.students[0] : r.students;
    const member: OverviewMember = { name: info?.name ?? "—", rollNumber: info?.roll_number ?? "—" };
    if (r.team_id) {
      if (!membersByTeamId.has(r.team_id)) membersByTeamId.set(r.team_id, []);
      membersByTeamId.get(r.team_id)!.push(member);
    } else {
      flatRegs.push({ eventSlug: r.event_slug, factionId: r.faction_id, member });
    }
  }

  const teams: OverviewTeam[] = (teamRows ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    eventSlug: t.event_slug,
    factionId: t.faction_id,
    subEventKey: t.sub_event,
    members: membersByTeamId.get(t.id) ?? [],
  }));

  return {
    factions: factions ?? [],
    teams,
    flatRegs,
    totalRegistrations: regs.length,
  };
}
