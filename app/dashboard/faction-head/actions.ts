"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { events } from "@/lib/data";
import { findConflict } from "@/lib/scheduleConflicts";
import { isRegistrationLocked } from "@/lib/eventLock";
import { activeConflictSlugs } from "@/lib/eliminationStatus";

type ActionResult = { error: string | null };
type CreateTeamResult = { error: string | null; teamId?: string };

function teamSizeMax(size: number | [number, number]): number {
  return Array.isArray(size) ? size[1] : size;
}

/** Faction name alone when there's only one team; a serial suffix only when there's more than one — per the naming rule. Sub-events (The Grid) always get a game-name suffix instead, since two same-faction rosters would otherwise collide. */
function computeTeamName(factionName: string, teamNumber: number, teamsPerFaction: number, subLabel?: string): string {
  if (subLabel) return `${factionName} — ${subLabel}`;
  if (teamsPerFaction <= 1) return factionName;
  return `${factionName} ${teamNumber}`;
}

/** Starts the next available team for this faction+event(+sub-event), auto-named and capped at the event's teamsPerFaction. */
export async function createTeam(eventSlug: string, subEventKey?: string): Promise<CreateTeamResult> {
  const session = await getSession();
  if (!session || session.role !== "faction_head") return { error: "Not authorized." };

  const event = events.find((e) => e.slug === eventSlug);
  if (!event) return { error: "Unknown event." };

  let teamsPerFaction: number;
  let subLabel: string | undefined;
  if (subEventKey) {
    const sub = event.subEvents?.find((s) => s.key === subEventKey);
    if (!sub) return { error: "Unknown sub-event." };
    teamsPerFaction = sub.teamsPerFaction;
    subLabel = sub.label;
  } else if (event.teamConfig) {
    teamsPerFaction = event.teamConfig.teamsPerFaction;
  } else {
    return { error: "This event doesn't use teams." };
  }

  if (isRegistrationLocked(eventSlug)) {
    return { error: `Registration for ${event.name} closed 24h before it started — no further changes allowed. Contact Ops for emergencies.` };
  }

  const supabase = createAdminClient();
  const { data: faction } = await supabase.from("factions").select("name").eq("id", session.factionId).maybeSingle();
  if (!faction) return { error: "Faction not found." };

  const { count } = await supabase
    .from("event_teams")
    .select("id", { count: "exact", head: true })
    .eq("event_slug", eventSlug)
    .eq("faction_id", session.factionId)
    .eq("sub_event", subEventKey ?? "");

  const existing = count ?? 0;
  if (existing >= teamsPerFaction) {
    return { error: `Max ${teamsPerFaction} team${teamsPerFaction > 1 ? "s" : ""} reached for this event.` };
  }

  const teamNumber = existing + 1;
  const name = computeTeamName(faction.name, teamNumber, teamsPerFaction, subLabel);

  const { data: team, error } = await supabase
    .from("event_teams")
    .insert({
      event_slug: eventSlug,
      faction_id: session.factionId,
      sub_event: subEventKey ?? "",
      team_number: teamNumber,
      name,
    })
    .select("id")
    .single();

  if (error || !team) return { error: "Couldn't start the team — try again." };

  revalidatePath("/dashboard/faction-head");
  return { error: null, teamId: team.id };
}

export async function addRegistration(studentId: string, eventSlug: string, teamId?: string, isSubstitute?: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "faction_head") return { error: "Not authorized." };

  const event = events.find((e) => e.slug === eventSlug);
  if (!event) return { error: "Unknown event." };

  const usesTeams = !!event.teamConfig || !!event.subEvents;
  if (usesTeams && !teamId) return { error: "Select or start a team first." };

  if (isSubstitute && !event.subEvents) {
    return { error: "Substitute registration is only available for gaming events." };
  }

  if (isRegistrationLocked(eventSlug)) {
    return { error: `Registration for ${event.name} closed 24h before it started — no further changes allowed. Contact Ops for emergencies.` };
  }

  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, faction_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.faction_id !== session.factionId) {
    return { error: "That student isn't in your faction." };
  }

  const { data: studentRegs } = await supabase
    .from("event_registrations")
    .select("event_slug, team_id, is_substitute")
    .eq("student_id", studentId);
  const allSlugs = (studentRegs ?? []).map((r) => r.event_slug);
  // Substitute registrations, and any registration where the student's
  // unit has already been eliminated, don't count toward the conflict
  // check — once they're out of an event it no longer blocks them from
  // joining something else that overlaps its schedule.
  const nonSubSlugs = await activeConflictSlugs(studentId, studentRegs ?? []);

  if (allSlugs.includes(eventSlug)) return { error: "Already registered for this event." };

  if (!isSubstitute) {
    const conflictSlug = findConflict(eventSlug, nonSubSlugs);
    if (conflictSlug) {
      const conflictName = events.find((e) => e.slug === conflictSlug)?.name ?? conflictSlug;
      await supabase.from("conflict_attempts").insert({
        student_id: studentId,
        faction_id: session.factionId,
        attempted_event_slug: eventSlug,
        conflicting_event_slug: conflictSlug,
        attempted_by: session.id,
      });
      return { error: `Not allowed — already in ${conflictName}, which can't be combined with ${event.name}.` };
    }
  }

  let teamDbId: string | null = null;

  if (usesTeams) {
    const { data: teamRow } = await supabase
      .from("event_teams")
      .select("id, sub_event, event_slug, faction_id")
      .eq("id", teamId!)
      .maybeSingle();
    if (!teamRow || teamRow.event_slug !== eventSlug || teamRow.faction_id !== session.factionId) {
      return { error: "Invalid team." };
    }

    const teamConfig = teamRow.sub_event
      ? event.subEvents?.find((s) => s.key === teamRow.sub_event)
      : event.teamConfig;
    if (!teamConfig) return { error: "Invalid team configuration." };

    const { count: teamCount } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamRow.id);
    const maxSize = teamSizeMax(teamConfig.membersPerTeam);
    if ((teamCount ?? 0) >= maxSize) {
      return { error: `This team is full (${maxSize} members max).` };
    }

    teamDbId = teamRow.id;
  } else {
    const { count: eventFactionCount } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("faction_id", session.factionId)
      .eq("event_slug", eventSlug);
    if ((eventFactionCount ?? 0) >= (event.flatSlotsPerFaction ?? 0)) {
      return { error: `${event.name} is full for your faction (${event.flatSlotsPerFaction} slots).` };
    }
  }

  const { error } = await supabase.from("event_registrations").insert({
    student_id: studentId,
    faction_id: session.factionId,
    event_slug: eventSlug,
    registered_by: session.id,
    team_id: teamDbId,
    is_substitute: !!isSubstitute,
  });
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/faction-head");
  return { error: null };
}

export async function removeRegistration(registrationId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "faction_head") return { error: "Not authorized." };

  const supabase = createAdminClient();

  const { data: reg } = await supabase
    .from("event_registrations")
    .select("event_slug")
    .eq("id", registrationId)
    .eq("faction_id", session.factionId)
    .maybeSingle();
  if (!reg) return { error: "Registration not found." };

  if (isRegistrationLocked(reg.event_slug)) {
    const event = events.find((e) => e.slug === reg.event_slug);
    return { error: `Registration for ${event?.name ?? reg.event_slug} closed 24h before it started — no further changes allowed. Contact Ops for emergencies.` };
  }

  const { error } = await supabase
    .from("event_registrations")
    .delete()
    .eq("id", registrationId)
    .eq("faction_id", session.factionId);
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/faction-head");
  return { error: null };
}
