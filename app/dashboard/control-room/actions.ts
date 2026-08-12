"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { notifyDocumentationReady } from "@/lib/notify";

type ActionResult = { error: string | null };

function isAuthorized(role: string | undefined) {
  return role === "control_room" || role === "main_coordinator";
}

/** Step 1: cross-check the faculty-approved list against event details. */
export async function crossCheckResult(resultId: string, approve: boolean, reason?: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !isAuthorized(session.role)) return { error: "Not authorized." };

  const supabase = createAdminClient();

  const { data: result } = await supabase
    .from("event_results")
    .select("id, status")
    .eq("id", resultId)
    .maybeSingle();

  if (!result || result.status !== "faculty_approved") {
    return { error: "This result isn't awaiting cross-check anymore." };
  }

  const { error } = await supabase
    .from("event_results")
    .update({
      status: approve ? "control_verified" : "control_rejected",
      control_verified_by: session.id,
      control_verified_at: new Date().toISOString(),
      rejection_reason: approve ? null : (reason?.trim() || "Sent back by control room — no reason given."),
    })
    .eq("id", resultId)
    .eq("status", "faculty_approved");

  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/control-room");
  revalidatePath("/dashboard/coordinator");
  return { error: null };
}

/** Step 2: publish — goes live on the leaderboard and closes the event. */
export async function publishResult(resultId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !isAuthorized(session.role)) return { error: "Not authorized." };

  const supabase = createAdminClient();

  const { data: result } = await supabase
    .from("event_results")
    .select("id, event_slug, status")
    .eq("id", resultId)
    .maybeSingle();

  if (!result || result.status !== "control_verified") {
    return { error: "This result isn't ready to publish." };
  }

  const { error } = await supabase
    .from("event_results")
    .update({
      status: "published",
      published_by: session.id,
      published_at: new Date().toISOString(),
    })
    .eq("id", resultId)
    .eq("status", "control_verified");

  if (error) return { error: "Something went wrong. Try again." };

  await notifyDocumentationReady(result.event_slug);

  revalidatePath("/dashboard/control-room");
  revalidatePath("/dashboard/coordinator");
  revalidatePath("/dashboard/documentation");
  revalidatePath("/leaderboard");
  return { error: null };
}
