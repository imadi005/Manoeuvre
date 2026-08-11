import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { events } from "@/lib/data";

type RecipientType = "student" | "organizer";

const EMAIL_DOMAIN = "kristujayanti.com";

/** Students, faction heads, and most organizers carry a KJIT roll number —
 * their address is always this pattern, never stored separately. */
export function deriveKjitEmail(rollNumber: string): string {
  return `${rollNumber.toLowerCase()}@${EMAIL_DOMAIN}`;
}

/**
 * Sends via Resend when RESEND_API_KEY and RESEND_FROM_EMAIL are
 * configured. Every attempt is logged to the notifications table
 * regardless, so nothing is silently lost while that's being set up —
 * unconfigured sends land as 'skipped_no_config', not as errors.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, error: "skipped_no_config" };

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to, subject, text });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `send_error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function notify({
  recipientType,
  recipientId,
  email,
  type,
  subject,
  message,
}: {
  recipientType: RecipientType;
  recipientId: string;
  email: string | null;
  type: string;
  subject: string;
  message: string;
}) {
  const supabase = createAdminClient();

  let status: "sent" | "failed" | "skipped_no_config" = "skipped_no_config";
  let error: string | null = null;

  if (email) {
    const result = await sendEmail(email, subject, message);
    if (result.ok) status = "sent";
    else if (result.error === "skipped_no_config") status = "skipped_no_config";
    else {
      status = "failed";
      error = result.error ?? "unknown_error";
    }
  } else {
    error = "no_email_on_file";
  }

  await supabase.from("notifications").insert({
    recipient_type: recipientType,
    recipient_id: recipientId,
    channel: "email",
    type,
    message: `${subject}\n\n${message}`,
    status,
    error,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  });
}

/** Faculty have no roll number, so their email is self-reported at first login. */
async function organizerEmail(organizer: { roll_number: string | null; email: string | null }): Promise<string | null> {
  if (organizer.roll_number) return deriveKjitEmail(organizer.roll_number);
  return organizer.email;
}

async function organizersByRoleAndDetail(role: string, detail: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("organizers").select("id, roll_number, email").eq("role", role).eq("detail", detail);
  return data ?? [];
}

function eventName(slug: string): string {
  return events.find((e) => e.slug === slug)?.name ?? slug;
}

/** Event lead just submitted a result — the faculty in charge needs to review it. */
export async function notifyFacultyApprovalNeeded(eventSlug: string) {
  const faculty = await organizersByRoleAndDetail("faculty", eventSlug);
  const subject = `MANOEUVRE 2026: ${eventName(eventSlug)} results need your approval`;
  const message = `${eventName(eventSlug)} results have been submitted and are waiting on your approval. Please review in the portal.`;
  await Promise.all(
    faculty.map(async (f) =>
      notify({
        recipientType: "organizer",
        recipientId: f.id,
        email: await organizerEmail(f),
        type: "faculty_approval_needed",
        subject,
        message,
      })
    )
  );
}

/** Faculty approved — control room needs to cross-check before publishing. */
export async function notifyControlRoomReady(eventSlug: string) {
  const controlRoom = await organizersByRoleAndDetail("control_room", "Control Room");
  const subject = `MANOEUVRE 2026: ${eventName(eventSlug)} ready for cross-check`;
  const message = `${eventName(eventSlug)} results are faculty-approved and ready for cross-check.`;
  await Promise.all(
    controlRoom.map(async (c) =>
      notify({
        recipientType: "organizer",
        recipientId: c.id,
        email: await organizerEmail(c),
        type: "control_room_ready",
        subject,
        message,
      })
    )
  );
}

/** Control room published — documentation can now write up the event. */
export async function notifyDocumentationReady(eventSlug: string) {
  const docTeam = await organizersByRoleAndDetail("documentation", "Documentation");
  const subject = `MANOEUVRE 2026: ${eventName(eventSlug)} ready for documentation`;
  const message = `${eventName(eventSlug)} is closed and published — ready for documentation.`;
  await Promise.all(
    docTeam.map(async (d) =>
      notify({
        recipientType: "organizer",
        recipientId: d.id,
        email: await organizerEmail(d),
        type: "documentation_ready",
        subject,
        message,
      })
    )
  );
}

/** A student was pulled out of this event (schedule conflict / advanced elsewhere) — the event lead needs a replacement. */
export async function notifyReplacementNeeded(eventSlug: string, studentName: string, factionName: string, reason: string) {
  const leads = await organizersByRoleAndDetail("event_lead", eventSlug);
  const subject = `MANOEUVRE 2026: Replacement needed for ${eventName(eventSlug)}`;
  const message = `${studentName} (${factionName}) was withdrawn from ${eventName(eventSlug)} — ${reason}. Please arrange a replacement with the faction head.`;
  await Promise.all(
    leads.map(async (l) =>
      notify({
        recipientType: "organizer",
        recipientId: l.id,
        email: await organizerEmail(l),
        type: "replacement_needed",
        subject,
        message,
      })
    )
  );
}

/** A student's faction head just registered them for events. */
export async function notifyStudentRegistrationConfirmed(studentId: string, eventNames: string[]) {
  const supabase = createAdminClient();
  const { data: student } = await supabase.from("students").select("id, roll_number").eq("id", studentId).maybeSingle();
  if (!student) return;
  const subject = "MANOEUVRE 2026: Registration confirmed";
  const message = `You've been registered for ${eventNames.join(", ")}. Check the portal for schedule and details.`;
  await notify({
    recipientType: "student",
    recipientId: student.id,
    email: student.roll_number ? deriveKjitEmail(student.roll_number) : null,
    type: "registration_confirmed",
    subject,
    message,
  });
}

// --- Not yet wired to a scheduler ---
// The following need a recurring trigger (e.g. a daily cron calling a route
// handler) to actually fire on a timer -- Vercel Cron / a scheduled Supabase
// Edge Function are the natural free options. The send logic itself is the
// same `notify()` plumbing above; only the "when do these fire" part is
// still open. Flagging rather than building against a scheduler that isn't
// configured yet.
//
// - Faction-head deadline reminders (slots still open, registration closing soon)
// - Coordinator daily summary (events run, winners, documentation status, enrollments)
// - Faculty / event-schedule reminders ahead of each round
