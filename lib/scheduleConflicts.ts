import { onGroundWeek, finaleSchedule, type ScheduleBlock } from "./schedule";

interface TimeRange {
  start: number;
  end: number;
}

// Hard rule, independent of schedule timing: each pair listed here can't be
// combined, even if their rounds don't overlap on the calendar. Not a group —
// cortex-vortex and cyberpitch are each individually barred with
// blacktie-protocol, but are fine together.
const MUTUALLY_EXCLUSIVE_GROUPS: string[][] = [
  ["blacktie-protocol", "cortex-vortex"],
  ["blacktie-protocol", "cyberpitch"],
];

function sameExclusiveGroup(eventSlugA: string, eventSlugB: string): boolean {
  return MUTUALLY_EXCLUSIVE_GROUPS.some((group) => group.includes(eventSlugA) && group.includes(eventSlugB));
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

/** True if eventA and eventB clash — either their schedules overlap, or they're in the same hard mutual-exclusion group. */
export function eventsConflict(eventSlugA: string, eventSlugB: string): boolean {
  if (eventSlugA === eventSlugB) return false;
  if (sameExclusiveGroup(eventSlugA, eventSlugB)) return true;
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
