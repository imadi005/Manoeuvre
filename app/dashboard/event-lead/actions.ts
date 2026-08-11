"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { notifyFacultyApprovalNeeded } from "@/lib/notify";

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
