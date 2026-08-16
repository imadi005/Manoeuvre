"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";

const EVENT_SLUG = "blacktie-protocol";

type ActionResult = { error: string | null };
type Option = "A" | "B" | "C" | "D";

async function authorizedStudent() {
  const session = await getSession();
  if (!session || session.role !== "student") return null;

  const supabase = createAdminClient();
  const { data: reg } = await supabase
    .from("event_registrations")
    .select("id")
    .eq("student_id", session.id)
    .eq("event_slug", EVENT_SLUG)
    .maybeSingle();
  if (!reg) return null;

  return { studentId: session.id, supabase };
}

export interface QuizStatusResult {
  startedAt: string | null;
  durationMinutes: number;
  closedAt: string | null;
}

/** Polled every few seconds from the client while waiting/taking the quiz. */
export async function getQuizStatus(): Promise<QuizStatusResult | null> {
  const ctx = await authorizedStudent();
  if (!ctx) return null;

  const { data } = await ctx.supabase
    .from("quiz_state")
    .select("started_at, duration_minutes, closed_at")
    .eq("event_slug", EVENT_SLUG)
    .maybeSingle();

  return {
    startedAt: data?.started_at ?? null,
    durationMinutes: data?.duration_minutes ?? 40,
    closedAt: data?.closed_at ?? null,
  };
}

/** Fire-and-forget on every option click -- upserted so a refresh never loses progress. */
export async function saveAnswer(questionNumber: number, selectedOption: Option): Promise<ActionResult> {
  const ctx = await authorizedStudent();
  if (!ctx) return { error: "Not authorized." };
  const { studentId, supabase } = ctx;

  const { data: state } = await supabase
    .from("quiz_state")
    .select("started_at, duration_minutes, closed_at")
    .eq("event_slug", EVENT_SLUG)
    .maybeSingle();
  if (!state?.started_at) return { error: "The quiz hasn't started yet." };
  const endsAt = new Date(state.started_at).getTime() + state.duration_minutes * 60_000;
  if (state.closed_at || Date.now() > endsAt) return { error: "The quiz has closed." };

  const { data: existing } = await supabase
    .from("quiz_answers")
    .select("id")
    .eq("event_slug", EVENT_SLUG)
    .eq("student_id", studentId)
    .eq("question_number", questionNumber)
    .maybeSingle();

  const payload = {
    event_slug: EVENT_SLUG,
    student_id: studentId,
    question_number: questionNumber,
    selected_option: selectedOption,
    answered_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase.from("quiz_answers").update(payload).eq("id", existing.id)
    : await supabase.from("quiz_answers").insert(payload);

  if (error) return { error: "Couldn't save that answer. Try again." };
  return { error: null };
}

/** Called by the Submit button, and automatically by the client when the countdown hits zero. Idempotent. */
export async function submitQuiz(): Promise<ActionResult> {
  const ctx = await authorizedStudent();
  if (!ctx) return { error: "Not authorized." };
  const { studentId, supabase } = ctx;

  const { data: existing } = await supabase
    .from("quiz_submissions")
    .select("student_id")
    .eq("event_slug", EVENT_SLUG)
    .eq("student_id", studentId)
    .maybeSingle();
  if (existing) return { error: null }; // already submitted

  const [{ data: answers }, { data: questions }] = await Promise.all([
    supabase.from("quiz_answers").select("question_number, selected_option").eq("event_slug", EVENT_SLUG).eq("student_id", studentId),
    supabase.from("quiz_questions").select("question_number, correct_option").eq("event_slug", EVENT_SLUG),
  ]);

  const correctByQuestion = new Map((questions ?? []).map((q) => [q.question_number, q.correct_option]));
  let score = 0;
  for (const a of answers ?? []) {
    if (correctByQuestion.get(a.question_number) === a.selected_option) score += 1;
  }

  const { error } = await supabase.from("quiz_submissions").insert({
    event_slug: EVENT_SLUG,
    student_id: studentId,
    score,
  });
  if (error) return { error: "Couldn't submit. Try again." };

  return { error: null };
}
