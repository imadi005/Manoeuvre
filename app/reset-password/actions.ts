"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";
import { createSession, getSession } from "@/lib/auth/session";
import type { LoginState } from "@/app/login/actions";

const TABLE_BY_ROLE: Record<string, string> = {
  student: "students",
  faction_head: "faction_heads",
  main_coordinator: "organizers",
  event_lead: "organizers",
  control_room: "organizers",
  documentation: "organizers",
  faculty: "organizers",
  media: "organizers",
};

const DASHBOARD_BY_ROLE: Record<string, string> = {
  student: "/reveal",
  faction_head: "/dashboard/faction-head",
  main_coordinator: "/dashboard/coordinator",
  event_lead: "/dashboard/event-lead",
  control_room: "/dashboard/control-room",
  documentation: "/dashboard/documentation",
  faculty: "/dashboard/faculty",
  media: "/dashboard/media",
};

export async function resetPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustReset && !session.otpVerified) redirect("/verify-otp");

  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const updatePayload: Record<string, unknown> = { must_reset_password: false };
  const supabase = createAdminClient();

  if (session.role === "faculty") {
    const { data: existing } = await supabase.from("organizers").select("email").eq("id", session.id).maybeSingle();
    if (!existing?.email) {
      const email = String(formData.get("email") ?? "").trim();
      if (!email || !email.includes("@")) {
        return { error: "Enter a valid email address." };
      }
      updatePayload.email = email;
    }
  }

  const table = TABLE_BY_ROLE[session.role];
  updatePayload.password_hash = await hashPassword(newPassword);

  const { error } = await supabase
    .from(table)
    .update(updatePayload)
    .eq("id", session.id);

  if (error) {
    return { error: "Something went wrong. Try again." };
  }

  await createSession({ ...session, mustReset: false });
  redirect(DASHBOARD_BY_ROLE[session.role]);
}
