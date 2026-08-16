"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { setRoundStatus } from "./actions";

const EVENT_SLUG = "blacktie-protocol";

type ActionResult = { error: string | null };

async function authorizedLead() {
  const session = await getSession();
  if (!session || session.role !== "event_lead" || session.detail !== EVENT_SLUG) return null;
  return { organizerId: session.id, supabase: createAdminClient() };
}

export async function startQuiz(durationMinutes: number): Promise<ActionResult> {
  const ctx = await authorizedLead();
  if (!ctx) return { error: "Not authorized." };
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
    return { error: "Duration must be between 1 and 180 minutes." };
  }

  const { data: existing } = await ctx.supabase.from("quiz_state").select("started_at").eq("event_slug", EVENT_SLUG).maybeSingle();
  if (existing?.started_at) return { error: null }; // already started

  const payload = { event_slug: EVENT_SLUG, duration_minutes: durationMinutes, started_at: new Date().toISOString(), started_by: ctx.organizerId };
  const { error } = existing
    ? await ctx.supabase.from("quiz_state").update(payload).eq("event_slug", EVENT_SLUG)
    : await ctx.supabase.from("quiz_state").insert(payload);
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/event-lead");
  return { error: null };
}

export async function endQuizNow(): Promise<ActionResult> {
  const ctx = await authorizedLead();
  if (!ctx) return { error: "Not authorized." };

  const { error } = await ctx.supabase.from("quiz_state").update({ closed_at: new Date().toISOString() }).eq("event_slug", EVENT_SLUG);
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/event-lead");
  return { error: null };
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function uploadEasterEgg(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const ctx = await authorizedLead();
  if (!ctx) return { error: "Not authorized." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  if (file.size > MAX_FILE_BYTES) return { error: "File is too large (max 15MB)." };
  if (!file.type.startsWith("image/")) return { error: "Only images/GIFs are supported." };

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${EVENT_SLUG}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await ctx.supabase.storage.from("quiz-easter-eggs").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { error: "Upload failed. Try again." };

  const { error } = await ctx.supabase.from("quiz_easter_eggs").insert({
    event_slug: EVENT_SLUG,
    storage_path: path,
    uploaded_by: ctx.organizerId,
  });
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/event-lead");
  return { error: null };
}

/** Convenience only: pre-fills Round 1 "Advance" for the top N quiz scorers (ties broken by earliest submission). The event lead can still adjust individual students afterward via the normal Round 1 Advance buttons. */
export async function autoAdvanceTopScorers(n: number): Promise<ActionResult> {
  const ctx = await authorizedLead();
  if (!ctx) return { error: "Not authorized." };
  if (!Number.isFinite(n) || n < 1) return { error: "Invalid count." };

  const { data: submissions } = await ctx.supabase
    .from("quiz_submissions")
    .select("student_id, score, submitted_at")
    .eq("event_slug", EVENT_SLUG)
    .order("score", { ascending: false })
    .order("submitted_at", { ascending: true })
    .limit(n);

  if (!submissions || submissions.length === 0) return { error: "No submissions yet." };

  for (const s of submissions) {
    const result = await setRoundStatus(1, "student", s.student_id, "advanced");
    if (result.error) return { error: `Stopped partway: ${result.error}` };
  }

  return { error: null };
}
