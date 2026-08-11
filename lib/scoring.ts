import { events } from "./data";

// Fest-wide rule: 1st through 4th place split an event's total points this way.
export const PLACEMENT_SHARES = [0.4, 0.3, 0.2, 0.1] as const;

export function pointsForPlacement(eventSlug: string, place: 1 | 2 | 3 | 4): number {
  const event = events.find((e) => e.slug === eventSlug);
  const total = event?.pointsTier.points;
  if (total == null) return 0; // Bonus-tier events (points revealed later) contribute nothing yet.
  return Math.round(total * PLACEMENT_SHARES[place - 1]);
}

export interface VerifiedResult {
  event_slug: string;
  first_faction_id: string | null;
  second_faction_id: string | null;
  third_faction_id: string | null;
  fourth_faction_id: string | null;
}

export function computeFactionTotals(results: VerifiedResult[]): Map<string, number> {
  const totals = new Map<string, number>();
  const add = (factionId: string | null, points: number) => {
    if (!factionId || points === 0) return;
    totals.set(factionId, (totals.get(factionId) ?? 0) + points);
  };

  for (const r of results) {
    add(r.first_faction_id, pointsForPlacement(r.event_slug, 1));
    add(r.second_faction_id, pointsForPlacement(r.event_slug, 2));
    add(r.third_faction_id, pointsForPlacement(r.event_slug, 3));
    add(r.fourth_faction_id, pointsForPlacement(r.event_slug, 4));
  }

  return totals;
}
