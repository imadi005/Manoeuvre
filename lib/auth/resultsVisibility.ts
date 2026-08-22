import type { Session } from "./session";

/** Final placements (Winner/Runner-up/3rd) and the leaderboard are held back
 * from general view until 24 Aug -- only Control Room and the main
 * coordinators can see them early. */
export function canSeeFinalResults(session: Session | null): boolean {
  return session?.role === "control_room" || session?.role === "main_coordinator";
}
