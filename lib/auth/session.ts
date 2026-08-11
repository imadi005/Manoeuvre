import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "manoeuvre_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type Session =
  | {
      role: "student";
      id: string;
      rollNumber: string;
      name: string;
      factionId: string | null;
      mustReset: boolean;
      /** Set once the email OTP gate is cleared — required before mustReset users can reach /reset-password. */
      otpVerified?: boolean;
    }
  | {
      role: "faction_head";
      id: string;
      username: string;
      name: string;
      factionId: string;
      mustReset: boolean;
      otpVerified?: boolean;
    }
  | {
      role: "main_coordinator" | "event_lead" | "control_room" | "documentation" | "faculty";
      id: string;
      username: string;
      name: string;
      rollNumber: string | null;
      detail: string | null;
      mustReset: boolean;
      otpVerified?: boolean;
    };

export async function createSession(session: Session) {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
