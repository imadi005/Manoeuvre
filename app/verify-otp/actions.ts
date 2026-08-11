"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, createSession } from "@/lib/auth/session";
import { deriveKjitEmail } from "@/lib/notify";
import { sendLoginOtp, verifyLoginOtp } from "@/lib/otp";

type ActionResult = { error: string | null };

async function resolveRecipient(): Promise<{ type: "student" | "faction_head" | "organizer"; id: string; email: string | null } | null> {
  const session = await getSession();
  if (!session) return null;

  const supabase = createAdminClient();

  if (session.role === "student") {
    return { type: "student", id: session.id, email: deriveKjitEmail(session.rollNumber) };
  }
  if (session.role === "faction_head") {
    const { data } = await supabase.from("faction_heads").select("roll_number").eq("id", session.id).maybeSingle();
    return { type: "faction_head", id: session.id, email: data?.roll_number ? deriveKjitEmail(data.roll_number) : null };
  }
  const { data } = await supabase.from("organizers").select("roll_number, email").eq("id", session.id).maybeSingle();
  const email = data?.roll_number ? deriveKjitEmail(data.roll_number) : (data?.email ?? null);
  return { type: "organizer", id: session.id, email };
}

export async function verifyOtp(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code." };

  const recipient = await resolveRecipient();
  if (!recipient) return { error: "Session expired — log in again." };

  const result = await verifyLoginOtp(recipient.type, recipient.id, code);
  if (!result.ok) return { error: result.error };

  await createSession({ ...session, otpVerified: true });
  redirect("/reset-password");
}

export async function resendOtp(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  const recipient = await resolveRecipient();
  if (!recipient || !recipient.email) return { error: "No email on file — contact Ops." };

  const result = await sendLoginOtp(recipient.type, recipient.id, recipient.email);
  if (!result.ok) return { error: result.error };
  return { error: null };
}
