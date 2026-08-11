import "server-only";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notify";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 45;
const MAX_SENDS_PER_WINDOW = 4;
const SEND_WINDOW_MINUTES = 15;

type RecipientType = "student" | "faction_head" | "organizer";

// Fast keyed hash, not bcrypt — an OTP row is short-lived (10 min) and
// attempt-limited, so it doesn't need bcrypt's deliberate slowness. At
// 350+ concurrent verifications, bcrypt's ~100-300ms per call would queue
// requests; HMAC-SHA256 is near-instant and keeps this scalable.
function hashCode(code: string): string {
  const secret = process.env.SESSION_SECRET ?? "fallback-otp-secret";
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export type SendOtpResult = { ok: true } | { ok: false; error: string };

/** Sends a fresh OTP, replacing any still-live one for this recipient. Rate-limited per recipient, not globally — one student hammering retry doesn't throttle everyone else. */
export async function sendLoginOtp(recipientType: RecipientType, recipientId: string, email: string): Promise<SendOtpResult> {
  const supabase = createAdminClient();
  const now = new Date();

  const { data: recent } = await supabase
    .from("login_otps")
    .select("id, created_at")
    .eq("recipient_type", recipientType)
    .eq("recipient_id", recipientId)
    .gte("created_at", new Date(now.getTime() - SEND_WINDOW_MINUTES * 60_000).toISOString())
    .order("created_at", { ascending: false });

  if (recent && recent.length > 0) {
    const lastSentAt = new Date(recent[0].created_at).getTime();
    if (now.getTime() - lastSentAt < RESEND_COOLDOWN_SECONDS * 1000) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - (now.getTime() - lastSentAt)) / 1000);
      return { ok: false, error: `Wait ${waitSec}s before requesting another code.` };
    }
    if (recent.length >= MAX_SENDS_PER_WINDOW) {
      return { ok: false, error: "Too many codes requested. Try again in a few minutes." };
    }
  }

  const code = generateCode();
  const { error: insertError } = await supabase.from("login_otps").insert({
    recipient_type: recipientType,
    recipient_id: recipientId,
    code_hash: hashCode(code),
    expires_at: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000).toISOString(),
  });
  if (insertError) return { ok: false, error: "Couldn't generate a code. Try again." };

  const result = await sendEmail(
    email,
    "MANOEUVRE 2026: Your verification code",
    `Your one-time code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. Enter it on the portal to continue resetting your password.`
  );

  if (!result.ok && result.error !== "skipped_no_config") {
    return { ok: false, error: "Couldn't send the code. Try again in a moment." };
  }
  return { ok: true };
}

export type VerifyOtpResult = { ok: true } | { ok: false; error: string };

/** Checks the most recent unconsumed OTP for this recipient. Consumes it on success — one-time use. */
export async function verifyLoginOtp(recipientType: RecipientType, recipientId: string, code: string): Promise<VerifyOtpResult> {
  const supabase = createAdminClient();
  const now = new Date();

  const { data: otp } = await supabase
    .from("login_otps")
    .select("id, code_hash, attempts, expires_at, consumed_at")
    .eq("recipient_type", recipientType)
    .eq("recipient_id", recipientId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) return { ok: false, error: "No active code — request a new one." };
  if (new Date(otp.expires_at).getTime() < now.getTime()) return { ok: false, error: "Code expired — request a new one." };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many attempts — request a new one." };

  if (hashCode(code) !== otp.code_hash) {
    await supabase.from("login_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
    const remaining = MAX_ATTEMPTS - (otp.attempts + 1);
    return { ok: false, error: remaining > 0 ? `Incorrect code — ${remaining} attempt(s) left.` : "Too many attempts — request a new one." };
  }

  await supabase.from("login_otps").update({ consumed_at: now.toISOString() }).eq("id", otp.id);
  return { ok: true };
}
