"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { notifyFacultyApprovalNeeded } from "@/lib/notify";
import { events } from "@/lib/data";
import type { RoundStatus } from "@/lib/eventRoster";

type ActionResult = { error: string | null };

const LOCKED_STATUSES = new Set(["faculty_approved", "control_verified", "published"]);

export async function submitResult(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "event_lead" || !session.detail) {
    return { error: "Not authorized." };
  }

  const eventSlug = session.detail;
  const first = String(formData.get("first") ?? "") || null;
  const second = String(formData.get("second") ?? "") || null;
  const third = String(formData.get("third") ?? "") || null;
  const fourth = String(formData.get("fourth") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!first) {
    return { error: "At least a 1st place faction is required." };
  }

  const picked = [first, second, third, fourth].filter(Boolean);
  if (new Set(picked).size !== picked.length) {
    return { error: "The same faction can't be picked for two placements." };
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("event_results")
    .select("id, status")
    .eq("event_slug", eventSlug)
    .maybeSingle();

  if (existing && LOCKED_STATUSES.has(existing.status)) {
    return { error: "This result is already past the event lead stage and can no longer be edited." };
  }

  const payload = {
    event_slug: eventSlug,
    first_faction_id: first,
    second_faction_id: second,
    third_faction_id: third,
    fourth_faction_id: fourth,
    notes,
    status: "submitted" as const,
    submitted_by: session.id,
    faculty_approved_by: null,
    faculty_approved_at: null,
    control_verified_by: null,
    control_verified_at: null,
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase.from("event_results").update(payload).eq("id", existing.id)
    : await supabase.from("event_results").insert(payload);

  if (error) return { error: "Something went wrong. Try again." };

  await notifyFacultyApprovalNeeded(eventSlug);

  revalidatePath("/dashboard/event-lead");
  return { error: null };
}

/** Round-by-round advancement, entered directly by the event lead — no approval gate, unlike the final faction placement above. unitId is a team id for team-based events, a student id for flat events (The Blacktie Protocol). */
export async function setRoundStatus(
  roundNumber: number,
  unitType: "team" | "student",
  unitId: string,
  status: RoundStatus | null
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "event_lead" || !session.detail) {
    return { error: "Not authorized." };
  }

  const event = events.find((e) => e.slug === session.detail);
  if (!event) return { error: "Unknown event." };
  if (roundNumber < 1 || roundNumber > event.rounds) return { error: "Invalid round." };

  const supabase = createAdminClient();

  if (unitType === "team") {
    const { data: team } = await supabase
      .from("event_teams")
      .select("id, event_slug")
      .eq("id", unitId)
      .maybeSingle();
    if (!team || team.event_slug !== session.detail) return { error: "Invalid team." };
  } else {
    const { data: reg } = await supabase
      .from("event_registrations")
      .select("student_id, event_slug")
      .eq("student_id", unitId)
      .eq("event_slug", session.detail)
      .maybeSingle();
    if (!reg) return { error: "Invalid student." };
  }

  if (status === null) {
    const { error } = await supabase
      .from("event_round_results")
      .delete()
      .eq("event_slug", session.detail)
      .eq("round_number", roundNumber)
      .eq(unitType === "team" ? "team_id" : "student_id", unitId);
    if (error) return { error: "Something went wrong. Try again." };
    revalidatePath("/dashboard/event-lead");
    revalidatePath(`/events/${session.detail}`);
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
    .eq("event_slug", session.detail)
    .eq("round_number", roundNumber)
    .eq(unitType === "team" ? "team_id" : "student_id", unitId)
    .maybeSingle();

  const payload = {
    event_slug: session.detail,
    round_number: roundNumber,
    team_id: unitType === "team" ? unitId : null,
    student_id: unitType === "student" ? unitId : null,
    status,
    entered_by: session.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = existingRow
    ? await supabase.from("event_round_results").update(payload).eq("id", existingRow.id)
    : await supabase.from("event_round_results").insert(payload);

  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/event-lead");
  revalidatePath(`/events/${session.detail}`);
  return { error: null };
}
