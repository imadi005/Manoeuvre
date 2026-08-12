"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSession, type Session } from "@/lib/auth/session";
import { deriveKjitEmail } from "@/lib/notify";
import { sendLoginOtp } from "@/lib/otp";

type ActionResult = { error: string | null };

/**
 * Forgot-password re-lookup, deliberately mirroring login()'s account
 * resolution but skipping password verification — the point of this flow is
 * getting in *without* the old password. The email OTP (not the password) is
 * the actual security boundary here, same as it already is for every
 * must_reset_password login: default passwords are shared across many
 * accounts, so a stranger knowing someone's roll number was never the gate.
 */
export async function requestPasswordReset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const rawInput = String(formData.get("identifier") ?? "").trim();
  if (!rawInput) return { error: "Enter your username or roll number." };

  const supabase = createAdminClient();
  const rollNumberInput = rawInput.toUpperCase();
  const usernameInput = rawInput.toLowerCase();
  const notFound = { error: "No account found for that username or roll number." };

  const { data: student } = await supabase
    .from("students")
    .select("id, roll_number, name, faction_id")
    .eq("roll_number", rollNumberInput)
    .maybeSingle();

  if (student) {
    await supabase.from("students").update({ must_reset_password: true }).eq("id", student.id);
    await startReset(
      { role: "student", id: student.id, rollNumber: student.roll_number, name: student.name, factionId: student.faction_id, mustReset: true },
      "student",
      deriveKjitEmail(student.roll_number)
    );
  }

  const headSelect = "id, username, name, faction_id, roll_number";
  const { data: headByUsername } = await supabase.from("faction_heads").select(headSelect).eq("username", usernameInput).maybeSingle();
  const { data: headByRoll } = await supabase.from("faction_heads").select(headSelect).eq("roll_number", rollNumberInput).maybeSingle();
  const head = headByUsername ?? headByRoll;

  if (head) {
    await supabase.from("faction_heads").update({ must_reset_password: true }).eq("id", head.id);
    const email = head.roll_number ? deriveKjitEmail(head.roll_number) : null;
    if (!email) return { error: "No email on file for this account — contact Ops directly." };
    await startReset(
      { role: "faction_head", id: head.id, username: head.username, name: head.name, factionId: head.faction_id, mustReset: true },
      "faction_head",
      email
    );
  }

  const orgSelect = "id, username, name, role, roll_number, detail, email";
  const { data: orgByUsername } = await supabase.from("organizers").select(orgSelect).eq("username", usernameInput).maybeSingle();
  const { data: orgByRollRows } = await supabase
    .from("organizers")
    .select(orgSelect)
    .eq("roll_number", rollNumberInput)
    .not("username", "is", null)
    .limit(1);
  const organizer = orgByUsername ?? orgByRollRows?.[0] ?? null;

  if (organizer) {
    await supabase.from("organizers").update({ must_reset_password: true }).eq("id", organizer.id);
    const email = organizer.roll_number ? deriveKjitEmail(organizer.roll_number) : organizer.email;
    if (!email) return { error: "No email on file for this account — contact Ops directly." };
    const role = organizer.role as "main_coordinator" | "event_lead" | "control_room" | "documentation" | "faculty";
    await startReset(
      { role, id: organizer.id, username: organizer.username, name: organizer.name, rollNumber: organizer.roll_number, detail: organizer.detail, mustReset: true },
      "organizer",
      email
    );
  }

  return notFound;
}

async function startReset(session: Session, recipientType: "student" | "faction_head" | "organizer", email: string) {
  await createSession(session);
  await sendLoginOtp(recipientType, session.id, email);
  redirect("/verify-otp");
}
