"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { notifyMediaPhotosNeeded } from "@/lib/notify";

type ActionResult = { error: string | null };

function isAuthorized(role: string | undefined) {
  return role === "control_room" || role === "main_coordinator";
}

/** One click: faculty-approved result goes live on the leaderboard and closes the event, or gets sent back to the event lead. */
export async function publishResult(resultId: string, approve: boolean, reason?: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !isAuthorized(session.role)) return { error: "Not authorized." };

  const supabase = createAdminClient();

  const { data: result } = await supabase
    .from("event_results")
    .select("id, event_slug, status")
    .eq("id", resultId)
    .maybeSingle();

  if (!result || result.status !== "faculty_approved") {
    return { error: "This result isn't awaiting publish anymore." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("event_results")
    .update(
      approve
        ? {
            status: "published",
            control_verified_by: session.id,
            control_verified_at: now,
            published_by: session.id,
            published_at: now,
          }
        : {
            status: "control_rejected",
            control_verified_by: session.id,
            control_verified_at: now,
            rejection_reason: reason?.trim() || "Sent back by control room — no reason given.",
          }
    )
    .eq("id", resultId)
    .eq("status", "faculty_approved");

  if (error) return { error: "Something went wrong. Try again." };

  if (approve) await notifyMediaPhotosNeeded(result.event_slug);

  revalidatePath("/dashboard/control-room");
  revalidatePath("/dashboard/coordinator");
  revalidatePath("/dashboard/media");
  revalidatePath("/leaderboard");
  return { error: null };
}
