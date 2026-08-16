import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface QuizQuestion {
  id: string;
  questionNumber: number;
  sectionLabel: string | null;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export interface QuizState {
  durationMinutes: number;
  startedAt: string | null;
  endsAt: string | null;
  closedAt: string | null;
}

export interface EasterEgg {
  id: string;
  url: string;
}

function computeEndsAt(startedAt: string | null, durationMinutes: number): string | null {
  if (!startedAt) return null;
  return new Date(new Date(startedAt).getTime() + durationMinutes * 60_000).toISOString();
}

export async function getQuizState(eventSlug: string): Promise<QuizState> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("quiz_state")
    .select("duration_minutes, started_at, closed_at")
    .eq("event_slug", eventSlug)
    .maybeSingle();

  const durationMinutes = data?.duration_minutes ?? 40;
  const startedAt = data?.started_at ?? null;
  return {
    durationMinutes,
    startedAt,
    endsAt: computeEndsAt(startedAt, durationMinutes),
    closedAt: data?.closed_at ?? null,
  };
}

export async function getQuizQuestions(eventSlug: string): Promise<QuizQuestion[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("quiz_questions")
    .select("id, question_number, section_label, question_text, option_a, option_b, option_c, option_d")
    .eq("event_slug", eventSlug)
    .order("question_number");

  return (data ?? []).map((q) => ({
    id: q.id,
    questionNumber: q.question_number,
    sectionLabel: q.section_label,
    questionText: q.question_text,
    optionA: q.option_a,
    optionB: q.option_b,
    optionC: q.option_c,
    optionD: q.option_d,
  }));
}

/** questionNumber -> selected option, for resuming after a refresh. */
export async function getStudentAnswers(eventSlug: string, studentId: string): Promise<Record<number, "A" | "B" | "C" | "D">> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("quiz_answers")
    .select("question_number, selected_option")
    .eq("event_slug", eventSlug)
    .eq("student_id", studentId);

  const answers: Record<number, "A" | "B" | "C" | "D"> = {};
  for (const a of data ?? []) answers[a.question_number] = a.selected_option as "A" | "B" | "C" | "D";
  return answers;
}

export async function getStudentSubmission(eventSlug: string, studentId: string): Promise<{ score: number; submittedAt: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("quiz_submissions")
    .select("score, submitted_at")
    .eq("event_slug", eventSlug)
    .eq("student_id", studentId)
    .maybeSingle();
  return data ? { score: data.score, submittedAt: data.submitted_at } : null;
}

export async function getEasterEggs(eventSlug: string): Promise<EasterEgg[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("quiz_easter_eggs").select("id, storage_path").eq("event_slug", eventSlug);
  return (data ?? []).map((e) => {
    const { data: pub } = supabase.storage.from("quiz-easter-eggs").getPublicUrl(e.storage_path);
    return { id: e.id, url: pub.publicUrl };
  });
}

export async function getSubmissionCount(eventSlug: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("quiz_submissions")
    .select("student_id", { count: "exact", head: true })
    .eq("event_slug", eventSlug);
  return count ?? 0;
}

/** True once the event lead has marked this student present -- the quiz only opens up after attendance. */
export async function isMarkedPresent(eventSlug: string, studentId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("event_attendance")
    .select("id")
    .eq("event_slug", eventSlug)
    .eq("student_id", studentId)
    .maybeSingle();
  return !!data;
}

export interface FullscreenViolation {
  studentId: string;
  studentName: string;
  rollNumber: string;
  count: number;
  lastAt: string;
}

/** Per-student fullscreen-exit counts, most recent first -- polled live by the event lead while the quiz is running. */
export async function getFullscreenViolations(eventSlug: string): Promise<FullscreenViolation[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("quiz_fullscreen_violations")
    .select("student_id, occurred_at, students(name, roll_number)")
    .eq("event_slug", eventSlug)
    .order("occurred_at", { ascending: false });

  type Row = {
    student_id: string;
    occurred_at: string;
    students: { name: string; roll_number: string } | { name: string; roll_number: string }[] | null;
  };

  const byStudent = new Map<string, FullscreenViolation>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const existing = byStudent.get(r.student_id);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const s = Array.isArray(r.students) ? r.students[0] : r.students;
    byStudent.set(r.student_id, {
      studentId: r.student_id,
      studentName: s?.name ?? "—",
      rollNumber: s?.roll_number ?? "—",
      count: 1,
      lastAt: r.occurred_at,
    });
  }
  return [...byStudent.values()].sort((a, b) => b.count - a.count);
}
