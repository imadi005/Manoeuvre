"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";

type ActionResult = { error: string | null };

export async function saveEventReport(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "documentation") {
    return { error: "Not authorized." };
  }

  const eventSlug = String(formData.get("eventSlug") ?? "");
  const summary = String(formData.get("summary") ?? "").trim();
  const highlights = String(formData.get("highlights") ?? "").trim();
  const issues = String(formData.get("issues") ?? "").trim();

  if (!eventSlug) return { error: "Missing event." };
  if (!summary) return { error: "Summary is required." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("event_reports").upsert(
    {
      event_slug: eventSlug,
      summary,
      highlights: highlights || null,
      issues: issues || null,
      written_by: session.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_slug" }
  );

  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/documentation");
  return { error: null };
}
