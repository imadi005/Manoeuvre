import { onGroundWeek, finaleSchedule, type ScheduleBlock } from "./schedule";

interface TimeRange {
  start: number;
  end: number;
}

function slugsOf(b: ScheduleBlock): string[] {
  if (b.eventSlugs) return b.eventSlugs;
  if (b.eventSlug) return [b.eventSlug];
  return [];
}

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

let cachedRangesByEvent: Map<string, TimeRange[]> | null = null;

/** Every event's round time ranges, keyed by slug — built once from lib/schedule.ts. */
function rangesByEvent(): Map<string, TimeRange[]> {
  if (cachedRangesByEvent) return cachedRangesByEvent;

  const map = new Map<string, TimeRange[]>();
  const allBlocks = [...onGroundWeek.flatMap((d) => d.blocks), ...finaleSchedule];

  for (const b of allBlocks) {
    if (!b.startsAt || !b.endsAt) continue;
    const range: TimeRange = { start: new Date(b.startsAt).getTime(), end: new Date(b.endsAt).getTime() };
    for (const slug of slugsOf(b)) {
      if (!map.has(slug)) map.set(slug, []);
      map.get(slug)!.push(range);
    }
  }

  cachedRangesByEvent = map;
  return map;
}

/** True if any round of eventA runs at the same time as any round of eventB. */
export function eventsConflict(eventSlugA: string, eventSlugB: string): boolean {
  if (eventSlugA === eventSlugB) return false;
  const map = rangesByEvent();
  const rangesA = map.get(eventSlugA) ?? [];
  const rangesB = map.get(eventSlugB) ?? [];
  return rangesA.some((ra) => rangesB.some((rb) => overlaps(ra, rb)));
}

/** Every other event whose schedule overlaps this one at any round. */
export function conflictingEventSlugs(eventSlug: string): string[] {
  const map = rangesByEvent();
  return [...map.keys()].filter((slug) => eventsConflict(eventSlug, slug));
}

/** Given the events a student is already in, which of those clash with a candidate event. */
export function findConflict(candidateEventSlug: string, currentEventSlugs: string[]): string | null {
  return currentEventSlugs.find((slug) => eventsConflict(candidateEventSlug, slug)) ?? null;
}
