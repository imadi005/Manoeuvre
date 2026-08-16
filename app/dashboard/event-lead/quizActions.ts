"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { getQuizState, getSubmissionCount, getFullscreenViolations, type FullscreenViolation } from "@/lib/quiz";
import { setRoundStatus } from "./actions";

const EVENT_SLUG = "blacktie-protocol";

type ActionResult = { error: string | null };

async function authorizedLead() {
  const session = await getSession();
  if (!session || session.role !== "event_lead" || session.detail !== EVENT_SLUG) return null;
  return { organizerId: session.id, supabase: createAdminClient() };
}

export interface QuizLiveStatus {
  startedAt: string | null;
  closedAt: string | null;
  submittedCount: number;
  violations: FullscreenViolation[];
}

/** Polled every few seconds from the event-lead's quiz control panel. */
export async function getQuizLiveStatus(): Promise<QuizLiveStatus | null> {
  const ctx = await authorizedLead();
  if (!ctx) return null;

  const [state, submittedCount, violations] = await Promise.all([
    getQuizState(EVENT_SLUG),
    getSubmissionCount(EVENT_SLUG),
    getFullscreenViolations(EVENT_SLUG),
  ]);

  return { startedAt: state.startedAt, closedAt: state.closedAt, submittedCount, violations };
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
