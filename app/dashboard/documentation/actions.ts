"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { notifyDocumentationApprovalNeeded } from "@/lib/notify";

type ActionResult = { error: string | null };

const LOCKED_STATUSES = new Set(["submitted", "approved"]);

export async function saveEventReport(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "documentation") {
    return { error: "Not authorized." };
  }

  const eventSlug = String(formData.get("eventSlug") ?? "");
  const summary = String(formData.get("summary") ?? "").trim();
  const objectives = String(formData.get("objectives") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "").trim();
  const feedback = String(formData.get("feedback") ?? "").trim();
  const webUrl = String(formData.get("webUrl") ?? "").trim();
  const highlights = String(formData.get("highlights") ?? "").trim();
  const issues = String(formData.get("issues") ?? "").trim();

  if (!eventSlug) return { error: "Missing event." };
  if (!summary) return { error: "Write-up is required." };

  const supabase = createAdminClient();

  const { data: existing } = await supabase.from("event_reports").select("status").eq("event_slug", eventSlug).maybeSingle();
  if (existing && LOCKED_STATUSES.has(existing.status)) {
    return { error: "This report is submitted or approved and can't be edited right now." };
  }

  const { error } = await supabase.from("event_reports").upsert(
    {
      event_slug: eventSlug,
      summary,
      objectives: objectives || null,
      outcome: outcome || null,
      feedback: feedback || null,
      web_url: webUrl || null,
      highlights: highlights || null,
      issues: issues || null,
      written_by: session.id,
      status: "draft",
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_slug" }
  );

  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/documentation");
  return { error: null };
}

export async function submitReportForApproval(eventSlug: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "documentation") {
    return { error: "Not authorized." };
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("event_reports").select("id, status, summary").eq("event_slug", eventSlug).maybeSingle();
  if (!existing) return { error: "Save the write-up before submitting." };
  if (!existing.summary) return { error: "Write-up is required before submitting." };
  if (LOCKED_STATUSES.has(existing.status)) return { error: "Already submitted or approved." };

  const { error } = await supabase
    .from("event_reports")
    .update({ status: "submitted", submitted_by: session.id, submitted_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { error: "Something went wrong. Try again." };

  await notifyDocumentationApprovalNeeded(eventSlug);

  revalidatePath("/dashboard/documentation");
  revalidatePath("/dashboard/faculty");
  return { error: null };
}
