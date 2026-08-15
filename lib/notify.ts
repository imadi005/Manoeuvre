import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { events, posterFor } from "@/lib/data";
import { firstRoundBlock } from "@/lib/schedule";

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
export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, error: "skipped_no_config" };

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      html ? { from, to, subject, text, html } : { from, to, subject, text }
    );
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
  html,
}: {
  recipientType: RecipientType;
  recipientId: string;
  email: string | null;
  type: string;
  subject: string;
  message: string;
  html?: string;
}) {
  const supabase = createAdminClient();

  let status: "sent" | "failed" | "skipped_no_config" | "skipped_disabled" = "skipped_no_config";
  let error: string | null = null;

  // Kill switch — every email that isn't the login OTP (a separate code path
  // in lib/otp.ts, unaffected) routes through here. Off by default; flip
  // WORKFLOW_EMAILS_ENABLED=true in the environment to turn the rest back on.
  const workflowEmailsEnabled = process.env.WORKFLOW_EMAILS_ENABLED === "true";

  if (!workflowEmailsEnabled) {
    status = "skipped_disabled";
    error = "workflow_emails_disabled";
  } else if (email) {
    const result = await sendEmail(email, subject, message, html);
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

/** Control room published — event is closed, media team can now shoot/upload photos. Documentation isn't notified yet; that happens once photos are actually in. */
export async function notifyMediaPhotosNeeded(eventSlug: string) {
  const media = await organizersByRoleAndDetail("media", "Media Team");
  const subject = `MANOEUVRE 2026: ${eventName(eventSlug)} closed — photos needed`;
  const message = `${eventName(eventSlug)} is closed. Upload geotagged and normal photos in the portal so documentation can start the write-up.`;
  await Promise.all(
    media.map(async (m) =>
      notify({
        recipientType: "organizer",
        recipientId: m.id,
        email: await organizerEmail(m),
        type: "media_photos_needed",
        subject,
        message,
      })
    )
  );
}

/** Documentation submitted their write-up — faculty in charge needs to approve it before it's visible to coordinators. */
export async function notifyDocumentationApprovalNeeded(eventSlug: string) {
  const faculty = await organizersByRoleAndDetail("faculty", eventSlug);
  const subject = `MANOEUVRE 2026: ${eventName(eventSlug)} write-up needs your approval`;
  const message = `The documentation team submitted the write-up for ${eventName(eventSlug)}. Please review and approve in the portal.`;
  await Promise.all(
    faculty.map(async (f) =>
      notify({
        recipientType: "organizer",
        recipientId: f.id,
        email: await organizerEmail(f),
        type: "documentation_approval_needed",
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

const SITE_URL = "https://kjitmanoeuvre.com";

/** Verified, live WhatsApp group invites per faction — everything faction-side (coordination, calls, updates) happens here. */
const WHATSAPP_LINK_BY_SLUG: Record<string, string> = {
  "neo-ronin": "https://chat.whatsapp.com/H2OEc6MWJGED9RoioWhnEz",
  hyperion: "https://chat.whatsapp.com/HJmhZ5z2xY29Si7mehX3XP",
  edgerunners: "https://chat.whatsapp.com/E4VRL3glJQjEfhIrfx9yxf",
  renegades: "https://chat.whatsapp.com/CvrKgs1ZJuJIjTD33vRMya",
  maelstrom: "https://chat.whatsapp.com/GOFuRP5wOW37SINuqqe7hQ",
  aetheris: "https://chat.whatsapp.com/HjT6A8bK3CKBFLyMg3F6yy",
  phoenix: "https://chat.whatsapp.com/IQ0J78h5KZaBk9nQza5CNo",
  nightwire: "https://chat.whatsapp.com/EYhuoxg4apS9e1vcrdPWx7",
};

/** Fun, on-brand "welcome to your faction" email — one-off blast, triggered manually via scripts/send-faction-welcome.ts. */
export async function notifyFactionWelcome(
  studentId: string,
  studentName: string,
  factionName: string,
  factionLore: string,
  factionSlug: string,
  accent: string
) {
  const supabase = createAdminClient();
  const { data: student } = await supabase.from("students").select("id, roll_number").eq("id", studentId).maybeSingle();
  if (!student) return;

  const firstName = studentName.split(" ")[0];
  const logoUrl = `${SITE_URL}/factions/${factionSlug}.png`;
  const whatsappUrl = WHATSAPP_LINK_BY_SLUG[factionSlug];
  const subject = `Welcome to ${factionName} — MANOEUVRE 2026`;

  const message = `Hey ${firstName},

You're in. ${factionName} just claimed you.

${factionLore}

Eight factions walked into MANOEUVRE 2026. One walks out on top — and from this second, that's on you as much as anyone else wearing the crest.

JOIN THE FACTION WHATSAPP GROUP NOW — ${whatsappUrl}
Everything happens there: updates, calls, coordination. Don't miss it.

Here's what to do next:
- Join the WhatsApp group above, right now
- Log in at ${SITE_URL}
  User ID: ${student.roll_number}
  Password: Manoeuvre@26
  (You'll be asked to verify a code and set your own password on first login.)
- Check the portal for your event lineup and the full schedule
- Rep ${factionName} loud — this is the one week nobody remembers "just a participant"
- Watch the leaderboard. It updates live. So should your energy.

See you on the ground.

— Team MANOEUVRE 2026`;

  // Fest brand palette (from app/globals.css) — magenta/cyan/yellow on void black,
  // matching the site chrome. `accent` (faction color) is used sparingly, just for
  // the crest ring and the faction name, so each faction still feels personalized.
  const MAGENTA = "#ff2b8f";
  const CYAN = "#3ee9e6";
  const YELLOW = "#f4e04d";
  const VOID = "#060309";
  const PANEL_LINE = "#24102f";
  const FOG = "#ede9f2";
  const FOG_DIM = "#a79fb8";

  const html = `<div style="background:${VOID};padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:${VOID};border:1px solid ${MAGENTA}66;border-radius:4px;overflow:hidden;box-shadow:0 0 24px ${MAGENTA}22;">
    <div style="height:4px;background:linear-gradient(90deg, ${MAGENTA}, ${YELLOW}, ${CYAN});"></div>
    <div style="padding:28px 24px 20px;text-align:center;border-bottom:1px solid ${PANEL_LINE};">
      <img src="${logoUrl}" alt="${factionName} crest" width="120" height="116" style="display:block;margin:0 auto 14px;border-radius:8px;border:2px solid ${accent};background:${VOID};" />
      <p style="margin:0;color:${YELLOW};font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;">// Manoeuvre 2026</p>
      <h1 style="margin:6px 0 0;color:${FOG};font-size:24px;text-transform:uppercase;letter-spacing:1px;">Welcome to <span style="color:${accent};">${factionName}</span></h1>
    </div>
    <div style="padding:24px;color:${FOG};font-size:14px;line-height:1.6;">
      <p>Hey ${firstName},</p>
      <p>You're in. <strong style="color:${accent};">${factionName}</strong> just claimed you.</p>
      <p style="font-style:italic;color:${FOG_DIM};border-left:2px solid ${MAGENTA};padding-left:12px;">${factionLore}</p>
      <p>Eight factions walked into MANOEUVRE 2026. One walks out on top — and from this second, that's on you as much as anyone else wearing the crest.</p>
      <div style="background:#0d1a12;border:1px solid #25d36655;border-radius:4px;padding:16px;margin:20px 0;text-align:center;">
        <p style="margin:0 0 10px;color:#25d366;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">// Join now — everything happens here</p>
        <a href="${whatsappUrl}" style="display:inline-block;background:#25d366;color:#062012;font-weight:bold;text-decoration:none;padding:10px 20px;border-radius:4px;font-size:14px;">Join ${factionName} on WhatsApp →</a>
        <p style="margin:10px 0 0;color:${FOG_DIM};font-size:12px;">Updates, calls, coordination — all in the group. Don't miss it.</p>
      </div>
      <div style="background:#0d0612;border:1px solid ${CYAN}44;border-radius:4px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 10px;color:${CYAN};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">// Login details</p>
        <p style="margin:0 0 4px;"><strong>Portal:</strong> <a href="${SITE_URL}" style="color:${CYAN};">${SITE_URL}</a></p>
        <p style="margin:0 0 4px;"><strong>User ID:</strong> ${student.roll_number}</p>
        <p style="margin:0;"><strong>Password:</strong> Manoeuvre@26</p>
        <p style="margin:8px 0 0;color:${FOG_DIM};font-size:12px;">You'll verify a code and set your own password on first login.</p>
      </div>
      <p style="margin:0 0 6px;">Here's what to do next:</p>
      <ul style="margin:0 0 16px;padding-left:20px;">
        <li>Join the WhatsApp group above, right now</li>
        <li>Check the portal for your event lineup and the full schedule</li>
        <li>Rep ${factionName} loud — this is the one week nobody remembers "just a participant"</li>
        <li>Watch the leaderboard. It updates live. So should your energy.</li>
      </ul>
      <p>See you on the ground.</p>
      <p style="color:${FOG_DIM};">— Team MANOEUVRE 2026</p>
    </div>
    <div style="height:4px;background:linear-gradient(90deg, ${CYAN}, ${YELLOW}, ${MAGENTA});"></div>
  </div>
</div>`;

  await notify({
    recipientType: "student",
    recipientId: student.id,
    email: student.roll_number ? deriveKjitEmail(student.roll_number) : null,
    type: "faction_welcome",
    subject,
    message,
    html,
  });
}

interface LockedRegistration {
  studentId: string;
  studentName: string;
  rollNumber: string;
  factionId: string;
  factionName: string;
  teamName: string | null;
}

/** Registration for this event just locked (24h before its first round) — confirms every registered student, and tells each faction head exactly who they registered. */
export async function notifyEventLocked(eventSlug: string) {
  const event = events.find((e) => e.slug === eventSlug);
  if (!event) return;

  const block = firstRoundBlock(eventSlug);
  const dateLabel = block?.date ?? "TBD";
  const timeLabel = block?.time ?? "TBD";
  const venueLabel = block?.venue ?? "TBD";
  const posterUrl = `${SITE_URL}${posterFor(eventSlug)}`;

  const supabase = createAdminClient();

  const { data: regRows } = await supabase
    .from("event_registrations")
    .select("student_id, faction_id, team_id, students(name, roll_number), event_teams(name)")
    .eq("event_slug", eventSlug);

  type RegRow = {
    student_id: string;
    faction_id: string;
    team_id: string | null;
    students: { name: string; roll_number: string } | { name: string; roll_number: string }[] | null;
    event_teams: { name: string } | { name: string }[] | null;
  };
  const regs = (regRows ?? []) as unknown as RegRow[];
  if (regs.length === 0) return;

  const factionIds = [...new Set(regs.map((r) => r.faction_id))];
  const { data: factionRows } = await supabase.from("factions").select("id, name").in("id", factionIds);
  const factionNameById = new Map((factionRows ?? []).map((f) => [f.id, f.name]));

  const registrations: LockedRegistration[] = regs.map((r) => {
    const student = Array.isArray(r.students) ? r.students[0] : r.students;
    const team = Array.isArray(r.event_teams) ? r.event_teams[0] : r.event_teams;
    return {
      studentId: r.student_id,
      studentName: student?.name ?? "—",
      rollNumber: student?.roll_number ?? "—",
      factionId: r.faction_id,
      factionName: factionNameById.get(r.faction_id) ?? "—",
      teamName: team?.name ?? null,
    };
  });

  // 1. Confirmation email to every registered student.
  await Promise.all(
    registrations.map((r) =>
      notify({
        recipientType: "student",
        recipientId: r.studentId,
        email: deriveKjitEmail(r.rollNumber),
        type: "event_locked_student",
        subject: `MANOEUVRE 2026: You're locked in for ${event.name}`,
        message: `You're registered for ${event.name}.\n\nDate: ${dateLabel}\nTime: ${timeLabel}\nVenue: ${venueLabel}\n\nRegistration is now closed — no changes possible. See you there.`,
        html: eventLockedStudentHtml(event.name, dateLabel, timeLabel, venueLabel, posterUrl, r.studentName.split(" ")[0]),
      })
    )
  );

  // 2. Summary email to every faction head of every faction that registered someone.
  const byFaction = new Map<string, LockedRegistration[]>();
  for (const r of registrations) {
    if (!byFaction.has(r.factionId)) byFaction.set(r.factionId, []);
    byFaction.get(r.factionId)!.push(r);
  }

  await Promise.all(
    [...byFaction.entries()].map(async ([factionId, members]) => {
      const { data: heads } = await supabase
        .from("faction_heads")
        .select("id, roll_number")
        .eq("faction_id", factionId);
      if (!heads || heads.length === 0) return;

      const factionName = factionNameById.get(factionId) ?? "your faction";
      const teamNames = [...new Set(members.map((m) => m.teamName).filter((n): n is string => !!n))];
      const teamCount = teamNames.length > 0 ? teamNames.length : 1;
      const peopleList = members.map((m) => `${m.studentName} (${m.rollNumber})`).join(", ");

      const message = `You registered ${teamCount} team${teamCount === 1 ? "" : "s"} from ${factionName} for ${event.name}, consisting of: ${peopleList}.\n\nVenue: ${venueLabel}\nTime: ${dateLabel}, ${timeLabel}\n\nRegistration is now locked — no further changes possible. Thank you!`;

      await Promise.all(
        heads.map((h) =>
          notify({
            recipientType: "organizer",
            recipientId: h.id,
            email: h.roll_number ? deriveKjitEmail(h.roll_number) : null,
            type: "event_locked_faction_head",
            subject: `MANOEUVRE 2026: ${event.name} registration locked — ${factionName}`,
            message,
            html: eventLockedFactionHeadHtml(event.name, factionName, teamCount, members, dateLabel, timeLabel, venueLabel),
          })
        )
      );
    })
  );
}

const MAGENTA = "#ff2b8f";
const CYAN = "#3ee9e6";
const YELLOW = "#f4e04d";
const VOID = "#060309";
const FOG = "#ede9f2";
const FOG_DIM = "#a79fb8";

function emailShell(bodyHtml: string): string {
  return `<div style="background:${VOID};padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:${VOID};border:1px solid ${CYAN}66;border-radius:4px;overflow:hidden;box-shadow:0 0 24px ${CYAN}22;">
    <div style="height:4px;background:linear-gradient(90deg, ${MAGENTA}, ${YELLOW}, ${CYAN});"></div>
    ${bodyHtml}
    <div style="height:4px;background:linear-gradient(90deg, ${CYAN}, ${YELLOW}, ${MAGENTA});"></div>
  </div>
</div>`;
}

function eventLockedStudentHtml(
  eventName: string,
  dateLabel: string,
  timeLabel: string,
  venueLabel: string,
  posterUrl: string,
  firstName: string
): string {
  return emailShell(`
    <img src="${posterUrl}" alt="${eventName} poster" width="480" style="display:block;width:100%;height:auto;" />
    <div style="padding:24px;color:${FOG};font-size:14px;line-height:1.6;">
      <p style="margin:0;color:${YELLOW};font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;">// Manoeuvre 2026 — You're Locked In</p>
      <h1 style="margin:6px 0 16px;color:${FOG};font-size:22px;text-transform:uppercase;letter-spacing:1px;">${eventName}</h1>
      <p>Hey ${firstName},</p>
      <p>Your registration for <strong style="color:${CYAN};">${eventName}</strong> is confirmed and locked.</p>
      <div style="background:#0d0612;border:1px solid ${CYAN}44;border-radius:4px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 4px;"><strong>Date:</strong> ${dateLabel}</p>
        <p style="margin:0 0 4px;"><strong>Time:</strong> ${timeLabel}</p>
        <p style="margin:0;"><strong>Venue:</strong> ${venueLabel}</p>
      </div>
      <p style="color:${FOG_DIM};">No further changes can be made to your registration. Be there on time.</p>
      <p style="color:${FOG_DIM};">— Team MANOEUVRE 2026</p>
    </div>
  `);
}

function eventLockedFactionHeadHtml(
  eventName: string,
  factionName: string,
  teamCount: number,
  members: LockedRegistration[],
  dateLabel: string,
  timeLabel: string,
  venueLabel: string
): string {
  const rows = members
    .map((m) => `<li>${m.studentName} <span style="color:${FOG_DIM};">(${m.rollNumber})</span>${m.teamName ? ` — <span style="color:${CYAN};">${m.teamName}</span>` : ""}</li>`)
    .join("");
  return emailShell(`
    <div style="padding:24px;color:${FOG};font-size:14px;line-height:1.6;">
      <p style="margin:0;color:${YELLOW};font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;">// Manoeuvre 2026 — Registration Locked</p>
      <h1 style="margin:6px 0 16px;color:${FOG};font-size:22px;text-transform:uppercase;letter-spacing:1px;">${eventName}</h1>
      <p>You registered <strong style="color:${CYAN};">${teamCount} team${teamCount === 1 ? "" : "s"}</strong> from <strong style="color:${MAGENTA};">${factionName}</strong> for ${eventName}, consisting of:</p>
      <ul style="margin:0 0 16px;padding-left:20px;">${rows}</ul>
      <div style="background:#0d0612;border:1px solid ${CYAN}44;border-radius:4px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 4px;"><strong>Time:</strong> ${dateLabel}, ${timeLabel}</p>
        <p style="margin:0;"><strong>Venue:</strong> ${venueLabel}</p>
      </div>
      <p style="color:${FOG_DIM};">Registration is now locked — no further changes possible. Thank you!</p>
      <p style="color:${FOG_DIM};">— Team MANOEUVRE 2026</p>
    </div>
  `);
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
