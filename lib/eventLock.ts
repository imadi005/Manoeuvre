import "server-only";
import { firstRoundStartsAt } from "./schedule";

const LOCK_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Per-event manual overrides for the default 24h-before-first-round cutoff — coordinator requests to keep a specific event's registration open later than usual. */
const REGISTRATION_LOCK_OVERRIDES: Record<string, string> = {
  cyberpitch: "2026-08-18T14:30:00+05:30",
};

/** When registration for this event closes — 24h before its first round, unless overridden above. Null if the event has no scheduled block yet. */
export function registrationLockTime(eventSlug: string): Date | null {
  if (REGISTRATION_LOCK_OVERRIDES[eventSlug]) return new Date(REGISTRATION_LOCK_OVERRIDES[eventSlug]);
  const start = firstRoundStartsAt(eventSlug);
  if (!start) return null;
  return new Date(start.getTime() - LOCK_WINDOW_MS);
}

/** True once the 24h-before-first-round cutoff has passed — faction heads can no longer add/remove/create teams for this event. */
export function isRegistrationLocked(eventSlug: string, now: Date = new Date()): boolean {
  const lockTime = registrationLockTime(eventSlug);
  if (!lockTime) return false;
  return now.getTime() >= lockTime.getTime();
}
