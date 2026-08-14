"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, clearSession, type Session } from "@/lib/auth/session";
import { deriveKjitEmail } from "@/lib/notify";
import { sendLoginOtp } from "@/lib/otp";
import { DASHBOARD_BY_ROLE } from "@/lib/dashboardPath";

export type LoginState = { error: string | null };

function nextRoute(role: Session["role"], mustReset: boolean) {
  return mustReset ? "/verify-otp" : DASHBOARD_BY_ROLE[role];
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawInput = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!rawInput || !password) {
    return { error: "Enter your username / roll number and password." };
  }

  const supabase = createAdminClient();
  const invalid = { error: "Invalid username or password." };

  const rollNumberInput = rawInput.toUpperCase();
  const usernameInput = rawInput.toLowerCase();

  // Students log in with their roll number (case-insensitive).
  const { data: student } = await supabase
    .from("students")
    .select("id, roll_number, name, faction_id, password_hash, must_reset_password")
    .eq("roll_number", rollNumberInput)
    .maybeSingle();

  if (student) {
    if (!(await verifyPassword(password, student.password_hash))) return invalid;
    await createSession({
      role: "student",
      id: student.id,
      rollNumber: student.roll_number,
      name: student.name,
      factionId: student.faction_id,
      mustReset: student.must_reset_password,
    });
    if (student.must_reset_password) {
      await sendLoginOtp("student", student.id, deriveKjitEmail(student.roll_number));
    }
    redirect(nextRoute("student", student.must_reset_password));
  }

  // Faction heads and organizers log in with either their assigned username
  // or their own roll number — most of them are students too.
  const headSelect = "id, username, name, faction_id, roll_number, password_hash, must_reset_password";
  const { data: headByUsername } = await supabase
    .from("faction_heads")
    .select(headSelect)
    .eq("username", usernameInput)
    .maybeSingle();
  const { data: headByRoll } = await supabase
    .from("faction_heads")
    .select(headSelect)
    .eq("roll_number", rollNumberInput)
    .maybeSingle();
  const head = headByUsername ?? headByRoll;

  if (head) {
    if (!(await verifyPassword(password, head.password_hash))) return invalid;
    await createSession({
      role: "faction_head",
      id: head.id,
      username: head.username,
      name: head.name,
      factionId: head.faction_id,
      mustReset: head.must_reset_password,
    });
    if (head.must_reset_password && head.roll_number) {
      await sendLoginOtp("faction_head", head.id, deriveKjitEmail(head.roll_number));
    }
    redirect(nextRoute("faction_head", head.must_reset_password));
  }

  const orgSelect = "id, username, name, role, roll_number, detail, email, password_hash, must_reset_password";
  const { data: orgByUsername } = await supabase
    .from("organizers")
    .select(orgSelect)
    .eq("username", usernameInput)
    .maybeSingle();
  const { data: orgByRollRows } = await supabase
    .from("organizers")
    .select(orgSelect)
    .eq("roll_number", rollNumberInput)
    .not("username", "is", null)
    .limit(1);
  const { data: orgByEmail } = await supabase
    .from("organizers")
    .select(orgSelect)
    .eq("email", usernameInput)
    .maybeSingle();
  const organizer = orgByUsername ?? orgByRollRows?.[0] ?? orgByEmail ?? null;

  if (organizer && organizer.password_hash) {
    if (!(await verifyPassword(password, organizer.password_hash))) return invalid;
    const role = organizer.role as "main_coordinator" | "event_lead" | "control_room" | "documentation" | "faculty" | "media";
    await createSession({
      role,
      id: organizer.id,
      username: organizer.username,
      name: organizer.name,
      rollNumber: organizer.roll_number,
      detail: organizer.detail,
      mustReset: organizer.must_reset_password,
    });
    if (organizer.must_reset_password) {
      const orgEmail = organizer.roll_number ? deriveKjitEmail(organizer.roll_number) : organizer.email;
      if (orgEmail) await sendLoginOtp("organizer", organizer.id, orgEmail);
    }
    redirect(nextRoute(role, organizer.must_reset_password));
  }

  return invalid;
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
