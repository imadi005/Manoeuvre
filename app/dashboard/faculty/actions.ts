"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { notifyControlRoomReady } from "@/lib/notify";

type ActionResult = { error: string | null };

export async function facultyDecision(resultId: string, approve: boolean, reason?: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || (session.role !== "faculty" && session.role !== "main_coordinator")) {
    return { error: "Not authorized." };
  }

  const supabase = createAdminClient();

  const { data: result } = await supabase
    .from("event_results")
    .select("id, event_slug, status")
    .eq("id", resultId)
    .maybeSingle();

  if (!result || result.status !== "submitted") {
    return { error: "This result isn't awaiting your approval anymore." };
  }

  if (session.role === "faculty" && session.detail !== result.event_slug) {
    return { error: "You can only review your own event." };
  }

  const { error } = await supabase
    .from("event_results")
    .update({
      status: approve ? "faculty_approved" : "faculty_rejected",
      faculty_approved_by: session.id,
      faculty_approved_at: new Date().toISOString(),
      rejection_reason: approve ? null : (reason?.trim() || "Sent back by faculty — no reason given."),
    })
    .eq("id", resultId)
    .eq("status", "submitted");

  if (error) return { error: "Something went wrong. Try again." };

  if (approve) {
    await notifyControlRoomReady(result.event_slug);
  }

  revalidatePath("/dashboard/faculty");
  revalidatePath("/dashboard/event-lead");
  revalidatePath("/dashboard/coordinator");
  return { error: null };
}
