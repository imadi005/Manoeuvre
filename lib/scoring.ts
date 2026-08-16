import { events } from "./data";

export type PlacementTier = "winner" | "runner_up" | "third" | "participation";

// Fest-wide rule: how an event's total points split across placement tiers.
export const PLACEMENT_SHARES: Record<PlacementTier, number> = {
  winner: 0.4,
  runner_up: 0.3,
  third: 0.2,
  participation: 0.1,
};

export function pointsForPlacement(eventSlug: string, tier: PlacementTier): number {
  const event = events.find((e) => e.slug === eventSlug);
  const total = event?.pointsTier.points;
  if (total == null) return 0; // Bonus-tier events (points revealed later) contribute nothing yet.
  return Math.round(total * PLACEMENT_SHARES[tier]);
}

export interface VerifiedResult {
  event_slug: string;
  first_faction_id: string | null;
  second_faction_id: string | null;
  third_faction_id: string | null;
}

/** Placement points (Winner/Runner-up/3rd) -- only counted once a result is published, same gate as before. */
export function computeFactionTotals(results: VerifiedResult[]): Map<string, number> {
  const totals = new Map<string, number>();
  const add = (factionId: string | null, points: number) => {
    if (!factionId || points === 0) return;
    totals.set(factionId, (totals.get(factionId) ?? 0) + points);
  };

  for (const r of results) {
    add(r.first_faction_id, pointsForPlacement(r.event_slug, "winner"));
    add(r.second_faction_id, pointsForPlacement(r.event_slug, "runner_up"));
    add(r.third_faction_id, pointsForPlacement(r.event_slug, "third"));
  }

  return totals;
}

export interface AttendanceRow {
  event_slug: string;
  faction_id: string;
}

/** Participation points -- immediate, live the moment a team/individual is marked present, independent of the faculty-approval chain. One share per unit that attended. */
export function computeParticipationTotals(attendance: AttendanceRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const a of attendance) {
    const points = pointsForPlacement(a.event_slug, "participation");
    if (points === 0) continue;
    totals.set(a.faction_id, (totals.get(a.faction_id) ?? 0) + points);
  }
  return totals;
}

export function mergeFactionTotals(...maps: Map<string, number>[]): Map<string, number> {
  const merged = new Map<string, number>();
  for (const map of maps) {
    for (const [factionId, points] of map) {
      merged.set(factionId, (merged.get(factionId) ?? 0) + points);
    }
  }
  return merged;
}
