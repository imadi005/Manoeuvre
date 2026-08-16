import { events } from "./data";

export type PlacementTier = "winner" | "runner_up" | "third" | "participation";

// Fest-wide rule: how an event's total points split across placement tiers.
export const PLACEMENT_SHARES: Record<PlacementTier, number> = {
  winner: 0.4,
  runner_up: 0.3,
  third: 0.2,
  participation: 0.1,
};

/** For events with subEvents (currently only The Grid's BGMI/PES), each sub-event is its own competition and draws from an equal split of the event's total pool -- fair since neither game outranks the other. */
export function pointsForPlacement(eventSlug: string, tier: PlacementTier, subEventKey?: string | null): number {
  const event = events.find((e) => e.slug === eventSlug);
  const total = event?.pointsTier.points;
  if (total == null) return 0; // Bonus-tier events (points revealed later) contribute nothing yet.
  const subEventCount = event?.subEvents?.length ?? 0;
  const scoped = subEventKey && subEventCount > 0 ? total / subEventCount : total;
  return Math.round(scoped * PLACEMENT_SHARES[tier]);
}

export interface VerifiedResult {
  event_slug: string;
  sub_event?: string | null;
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
    add(r.first_faction_id, pointsForPlacement(r.event_slug, "winner", r.sub_event));
    add(r.second_faction_id, pointsForPlacement(r.event_slug, "runner_up", r.sub_event));
    add(r.third_faction_id, pointsForPlacement(r.event_slug, "third", r.sub_event));
  }

  return totals;
}

export interface AttendanceRow {
  event_slug: string;
  faction_id: string;
  sub_event?: string | null;
}

/** Participation points -- immediate, live the moment a team/individual is marked present, independent of the faculty-approval chain. One share per unit that attended. */
export function computeParticipationTotals(attendance: AttendanceRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const a of attendance) {
    const points = pointsForPlacement(a.event_slug, "participation", a.sub_event);
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
