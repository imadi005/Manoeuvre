"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { notifyFacultyApprovalNeeded } from "@/lib/notify";
import { events } from "@/lib/data";
import type { RoundStatus } from "@/lib/eventRoster";

type ActionResult = { error: string | null };
type UnitType = "team" | "student";

async function authorizedEvent() {
  const session = await getSession();
  if (!session || session.role !== "event_lead" || !session.detail) return null;
  const event = events.find((e) => e.slug === session.detail);
  if (!event) return null;
  return { event, eventSlug: session.detail, organizerId: session.id };
}

interface UnitInfo {
  factionId: string;
  subEvent: string; // '' for events without subEvents (e.g. The Grid's bgmi/pes)
}

async function unitInfo(
  supabase: ReturnType<typeof createAdminClient>,
  unitType: UnitType,
  unitId: string,
  eventSlug: string
): Promise<UnitInfo | null> {
  if (unitType === "team") {
    const { data } = await supabase.from("event_teams").select("faction_id, sub_event, event_slug").eq("id", unitId).maybeSingle();
    if (!data || data.event_slug !== eventSlug) return null;
    return { factionId: data.faction_id, subEvent: data.sub_event ?? "" };
  }
  const { data } = await supabase
    .from("event_registrations")
    .select("faction_id")
    .eq("student_id", unitId)
    .eq("event_slug", eventSlug)
    .maybeSingle();
  if (!data) return null;
  return { factionId: data.faction_id, subEvent: "" };
}

/** Attendance -- marking present is what grants the immediate Participation point (via lib/scoring.ts reading event_attendance directly). Idempotent. */
export async function markPresent(unitType: UnitType, unitId: string): Promise<ActionResult> {
  const ctx = await authorizedEvent();
  if (!ctx) return { error: "Not authorized." };
  const { eventSlug, organizerId } = ctx;

  const supabase = createAdminClient();
  const info = await unitInfo(supabase, unitType, unitId, eventSlug);
  if (!info) return { error: "Invalid team/student for this event." };

  const { data: existing } = await supabase
    .from("event_attendance")
    .select("id")
    .eq("event_slug", eventSlug)
    .eq(unitType === "team" ? "team_id" : "student_id", unitId)
    .maybeSingle();
  if (existing) return { error: null };

  const { error } = await supabase.from("event_attendance").insert({
    event_slug: eventSlug,
    team_id: unitType === "team" ? unitId : null,
    student_id: unitType === "student" ? unitId : null,
    faction_id: info.factionId,
    sub_event: info.subEvent,
    marked_by: organizerId,
  });
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/event-lead");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard/coordinator");
  return { error: null };
}

/** The Grid only: per-member presence within a squad, purely informational
 * (doesn't touch event_attendance/scoring) -- lets the event lead see who on
 * a BGMI/PES team actually showed up, for substitute-swap calls. Toggles. */
export async function markMemberPresent(teamId: string, studentId: string): Promise<ActionResult> {
  const ctx = await authorizedEvent();
  if (!ctx) return { error: "Not authorized." };
  const { event, eventSlug, organizerId } = ctx;
  if (event.slug !== "the-grid") return { error: "Not available for this event." };

  const supabase = createAdminClient();

  const { data: team } = await supabase.from("event_teams").select("id, event_slug").eq("id", teamId).maybeSingle();
  if (!team || team.event_slug !== eventSlug) return { error: "Invalid team." };

  const { data: reg } = await supabase
    .from("event_registrations")
    .select("id")
    .eq("student_id", studentId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!reg) return { error: "That student isn't on this team." };

  const { data: existing } = await supabase
    .from("event_member_attendance")
    .select("id")
    .eq("team_id", teamId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("event_member_attendance").delete().eq("id", existing.id);
    if (error) return { error: "Something went wrong. Try again." };
  } else {
    const { error } = await supabase.from("event_member_attendance").insert({
      event_slug: eventSlug,
      team_id: teamId,
      student_id: studentId,
      marked_by: organizerId,
    });
    if (error) return { error: "Something went wrong. Try again." };
  }

  revalidatePath("/dashboard/event-lead");
  return { error: null };
}

/** Moves the event out of the attendance phase into Round 1. */
export async function startEvent(): Promise<ActionResult> {
  const ctx = await authorizedEvent();
  if (!ctx) return { error: "Not authorized." };
  const { eventSlug } = ctx;

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("event_progress")
    .select("current_round")
    .eq("event_slug", eventSlug)
    .maybeSingle();
  if (existing && existing.current_round > 0) return { error: null }; // already started

  const { error } = existing
    ? await supabase.from("event_progress").update({ current_round: 1, started_at: new Date().toISOString() }).eq("event_slug", eventSlug)
    : await supabase.from("event_progress").insert({ event_slug: eventSlug, current_round: 1, started_at: new Date().toISOString() });
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/event-lead");
  return { error: null };
}

/** Round-by-round advancement, entered directly by the event lead — no approval gate, unlike the final faction placement. unitId is a team id for team-based events, a student id for flat events. Also used for the final round's Winner/Runner-up/3rd toggles. */
export async function setRoundStatus(
  roundNumber: number,
  unitType: UnitType,
  unitId: string,
  status: RoundStatus | null
): Promise<ActionResult> {
  const ctx = await authorizedEvent();
  if (!ctx) return { error: "Not authorized." };
  const { event, eventSlug, organizerId } = ctx;
  if (roundNumber < 1 || roundNumber > event.rounds) return { error: "Invalid round." };

  const supabase = createAdminClient();

  if (unitType === "team") {
    const { data: team } = await supabase.from("event_teams").select("id, event_slug").eq("id", unitId).maybeSingle();
    if (!team || team.event_slug !== eventSlug) return { error: "Invalid team." };
  } else {
    const { data: reg } = await supabase
      .from("event_registrations")
      .select("student_id, event_slug")
      .eq("student_id", unitId)
      .eq("event_slug", eventSlug)
      .maybeSingle();
    if (!reg) return { error: "Invalid student." };
  }

  if (status === null) {
    const { error } = await supabase
      .from("event_round_results")
      .delete()
      .eq("event_slug", eventSlug)
      .eq("round_number", roundNumber)
      .eq(unitType === "team" ? "team_id" : "student_id", unitId);
    if (error) return { error: "Something went wrong. Try again." };
    revalidatePath("/dashboard/event-lead");
    revalidatePath(`/events/${eventSlug}`);
    return { error: null };
  }

  // Not a .upsert() with onConflict: the uniqueness here comes from partial
  // indexes (event_round_results_team_unique / _student_unique), and Postgres
  // only matches ON CONFLICT against a partial index when the conflict target
  // repeats that index's WHERE predicate — plain onConflict column lists
  // silently fail to resolve against it. Select-then-write sidesteps that.
  const { data: existingRow } = await supabase
    .from("event_round_results")
    .select("id")
    .eq("event_slug", eventSlug)
    .eq("round_number", roundNumber)
    .eq(unitType === "team" ? "team_id" : "student_id", unitId)
    .maybeSingle();

  const payload = {
    event_slug: eventSlug,
    round_number: roundNumber,
    team_id: unitType === "team" ? unitId : null,
    student_id: unitType === "student" ? unitId : null,
    status,
    entered_by: organizerId,
    updated_at: new Date().toISOString(),
  };

  const { error } = existingRow
    ? await supabase.from("event_round_results").update(payload).eq("id", existingRow.id)
    : await supabase.from("event_round_results").insert(payload);

  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/event-lead");
  revalidatePath(`/events/${eventSlug}`);
  return { error: null };
}

/** Closes the given (currently active) round: anyone who didn't get an explicit "Advance" is auto-eliminated, then the event moves to the next round. */
export async function closeRound(roundNumber: number): Promise<ActionResult> {
  const ctx = await authorizedEvent();
  if (!ctx) return { error: "Not authorized." };
  const { event, eventSlug, organizerId } = ctx;
  if (roundNumber >= event.rounds) return { error: "The final round doesn't close this way — mark the event completed instead." };

  const supabase = createAdminClient();

  const { data: progress } = await supabase
    .from("event_progress")
    .select("current_round")
    .eq("event_slug", eventSlug)
    .maybeSingle();
  if (!progress || progress.current_round !== roundNumber) {
    return { error: "This round isn't the active round anymore." };
  }

  // Who was in this round: present at attendance for round 1, or advanced out of the previous round otherwise.
  let inRoundTeamIds: string[] = [];
  let inRoundStudentIds: string[] = [];
  if (roundNumber === 1) {
    const { data: attendance } = await supabase.from("event_attendance").select("team_id, student_id").eq("event_slug", eventSlug);
    inRoundTeamIds = (attendance ?? []).map((a) => a.team_id).filter((v): v is string => !!v);
    inRoundStudentIds = (attendance ?? []).map((a) => a.student_id).filter((v): v is string => !!v);
  } else {
    const { data: advanced } = await supabase
      .from("event_round_results")
      .select("team_id, student_id")
      .eq("event_slug", eventSlug)
      .eq("round_number", roundNumber - 1)
      .eq("status", "advanced");
    inRoundTeamIds = (advanced ?? []).map((a) => a.team_id).filter((v): v is string => !!v);
    inRoundStudentIds = (advanced ?? []).map((a) => a.student_id).filter((v): v is string => !!v);
  }

  const { data: alreadyAdvanced } = await supabase
    .from("event_round_results")
    .select("team_id, student_id")
    .eq("event_slug", eventSlug)
    .eq("round_number", roundNumber)
    .eq("status", "advanced");
  const advancedTeamIds = new Set((alreadyAdvanced ?? []).map((a) => a.team_id).filter(Boolean));
  const advancedStudentIds = new Set((alreadyAdvanced ?? []).map((a) => a.student_id).filter(Boolean));

  const eliminatedRows = [
    ...inRoundTeamIds
      .filter((id) => !advancedTeamIds.has(id))
      .map((id) => ({ event_slug: eventSlug, round_number: roundNumber, team_id: id, student_id: null, status: "eliminated", entered_by: organizerId })),
    ...inRoundStudentIds
      .filter((id) => !advancedStudentIds.has(id))
      .map((id) => ({ event_slug: eventSlug, round_number: roundNumber, team_id: null, student_id: id, status: "eliminated", entered_by: organizerId })),
  ];

  if (eliminatedRows.length > 0) {
    const { error: elimError } = await supabase.from("event_round_results").insert(eliminatedRows);
    if (elimError) return { error: "Something went wrong closing the round. Try again." };
  }

  const { error } = await supabase
    .from("event_progress")
    .update({ current_round: roundNumber + 1, updated_at: new Date().toISOString() })
    .eq("event_slug", eventSlug);
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/event-lead");
  revalidatePath(`/events/${eventSlug}`);
  return { error: null };
}

/** Final round is complete: resolves Winner/Runner-up/3rd into their factions, auto-submits the result into the existing faculty-approval pipeline, and marks the event finished. For events with subEvents (The Grid's BGMI/PES), each sub-event gets its own placement + its own event_results row, and each must have a Winner before anything is written. */
export async function completeEvent(): Promise<ActionResult> {
  const ctx = await authorizedEvent();
  if (!ctx) return { error: "Not authorized." };
  const { event, eventSlug, organizerId } = ctx;

  const supabase = createAdminClient();

  const { data: progress } = await supabase
    .from("event_progress")
    .select("current_round, completed_at")
    .eq("event_slug", eventSlug)
    .maybeSingle();
  if (!progress || progress.current_round !== event.rounds) {
    return { error: "The final round isn't active yet." };
  }
  if (progress.completed_at) return { error: "This event is already marked completed." };

  const { data: finalRows } = await supabase
    .from("event_round_results")
    .select("team_id, student_id, status")
    .eq("event_slug", eventSlug)
    .eq("round_number", event.rounds)
    .in("status", ["winner", "runner_up", "third"]);

  const rows = finalRows ?? [];
  const unitKey = (r: { team_id: string | null; student_id: string | null }) => (r.team_id ?? r.student_id)!;

  const infoByUnit = new Map<string, UnitInfo>();
  await Promise.all(
    rows.map(async (r) => {
      const info = await unitInfo(supabase, r.team_id ? "team" : "student", unitKey(r), eventSlug);
      if (info) infoByUnit.set(unitKey(r), info);
    })
  );

  const subEventKeys: (string | null)[] = event.subEvents ? event.subEvents.map((s) => s.key) : [null];

  const resolved: {
    subEventKey: string | null;
    firstFactionId: string | null;
    secondFactionId: string | null;
    thirdFactionId: string | null;
  }[] = [];

  for (const subEventKey of subEventKeys) {
    const rowsHere = subEventKey ? rows.filter((r) => infoByUnit.get(unitKey(r))?.subEvent === subEventKey) : rows;
    const byTier = (tier: RoundStatus) => rowsHere.find((r) => r.status === tier);

    const winner = byTier("winner");
    if (!winner) {
      const label = subEventKey ? event.subEvents!.find((s) => s.key === subEventKey)!.label : null;
      return { error: label ? `Mark a Winner for ${label} before completing the event.` : "Mark a Winner before completing the event." };
    }
    const runnerUp = byTier("runner_up");
    const third = byTier("third");

    resolved.push({
      subEventKey,
      firstFactionId: infoByUnit.get(unitKey(winner))?.factionId ?? null,
      secondFactionId: runnerUp ? (infoByUnit.get(unitKey(runnerUp))?.factionId ?? null) : null,
      thirdFactionId: third ? (infoByUnit.get(unitKey(third))?.factionId ?? null) : null,
    });
  }

  for (const r of resolved) {
    const { data: existingResult } = await supabase
      .from("event_results")
      .select("id")
      .eq("event_slug", eventSlug)
      .eq("sub_event", r.subEventKey ?? "")
      .maybeSingle();

    const payload = {
      event_slug: eventSlug,
      sub_event: r.subEventKey ?? "",
      first_faction_id: r.firstFactionId,
      second_faction_id: r.secondFactionId,
      third_faction_id: r.thirdFactionId,
      notes: "Auto-submitted from the round tracker.",
      status: "submitted" as const,
      submitted_by: organizerId,
      faculty_approved_by: null,
      faculty_approved_at: null,
      control_verified_by: null,
      control_verified_at: null,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    };

    const { error: resultError } = existingResult
      ? await supabase.from("event_results").update(payload).eq("id", existingResult.id)
      : await supabase.from("event_results").insert(payload);
    if (resultError) return { error: "Something went wrong submitting the result. Try again." };
  }

  const { error: progressError } = await supabase
    .from("event_progress")
    .update({ current_round: event.rounds + 1, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("event_slug", eventSlug);
  if (progressError) return { error: "Result submitted, but couldn't mark the event completed. Contact Ops." };

  await notifyFacultyApprovalNeeded(eventSlug);

  revalidatePath("/dashboard/event-lead");
  revalidatePath(`/events/${eventSlug}`);
  return { error: null };
}
