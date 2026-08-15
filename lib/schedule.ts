// MANOEUVRE 2026 master schedule — Run-of-Show Draft v4.
// Per HoD direction: events of similar type run in parallel (separate
// venues, same time slot) so the same crowd doesn't sweep every event and
// participation spreads across factions. Four thematic pairs:
//   Mind Games — Cortex Vortex + Ghost Override
//   Boardroom  — The Blacktie Protocol + CyberPitch
//   Manhunt    — Room Zero + The Trace
//   Screens    — Blackout Build + The Grid
// Main-Stage finale moments (Blacktie R3, Cortex Vortex R3, CyberPitch R3)
// stay sequential — there's only one stage. The Grid's finale round is
// dropped entirely; it now ends after Round 2. Manhunt spans three days
// (Wed/Fri/Sat) instead of cramming into one Saturday, both to give Room
// Zero more breathing room per round and to keep Friday from being a
// single lonely block.
// Every day fills its full window using genuinely longer rounds, not
// padding — a break only ever sits between two different activities
// (never at the start/end of a day, never doubled around lunch). Weekdays
// run 2:40 – 5:10 PM; Saturday (22 Aug) runs 10:00 AM – 4:30 PM; the
// Finale (24 Aug) runs 10:00 AM – 5:30 PM (Closing Ceremony gets the
// extra hour).
//
// Manual timing swaps requested post-launch (each event keeps its own
// round number and venue — only the clock slot moves, so the thematic
// pairs above no longer hold cleanly on these three days):
//   18 Aug — CyberPitch (R1) <-> The Grid (R2)
//   22 Aug — CyberPitch (R2) <-> The Trace (R3)
//   24 Aug — The Blacktie Protocol / "IT Manager" (R3) <-> CyberPitch (R3)
//
// Fest-wide +40min push: every weekday block that used to start at 2:00 PM
// now starts at 2:40 PM, end times pushed the same 40 minutes — durations
// and break lengths are unchanged, the whole afternoon just starts later.
// Saturday and the Finale (both already starting at 10:00 AM) are untouched.

export interface ScheduleBlock {
  time: string;
  title: string;
  eventSlug?: string;
  /** Two events running concurrently in separate venues — same-type pairing to spread participation. */
  eventSlugs?: [string, string];
  /** Per-event round label shown under each half of a paired block, e.g. ["Round 1", "Round 1"]. */
  eventRoundLabels?: [string, string];
  venue?: string;
  isBreak?: boolean;
  /** ISO datetime (Asia/Kolkata) — omitted for blocks with no fixed physical slot. */
  startsAt?: string;
  endsAt?: string;
}

export interface ScheduleDay {
  dayLabel: string;
  date: string;
  weekday: string;
  window: string;
  blocks: ScheduleBlock[];
}

export const onGroundWeek: ScheduleDay[] = [
  {
    dayLabel: "Day 1",
    date: "17 Aug",
    weekday: "Monday",
    window: "2:40 PM – 5:10 PM",
    blocks: [
      { time: "2:40 – 3:30 PM", title: "Mind Games — Round 1", eventSlugs: ["cortex-vortex", "ghost-override"], eventRoundLabels: ["Round 1", "Round 1"], venue: "406 / B2", startsAt: "2026-08-17T14:40:00+05:30", endsAt: "2026-08-17T15:30:00+05:30" },
      { time: "3:30 – 3:40 PM", title: "Break", isBreak: true, startsAt: "2026-08-17T15:30:00+05:30", endsAt: "2026-08-17T15:40:00+05:30" },
      { time: "3:40 – 5:10 PM", title: "Screens — Round 1", eventSlugs: ["blackout-build", "the-grid"], eventRoundLabels: ["Round 1", "Round 1"], venue: "B3 / 406", startsAt: "2026-08-17T15:40:00+05:30", endsAt: "2026-08-17T17:10:00+05:30" },
    ],
  },
  {
    dayLabel: "Day 2",
    date: "18 Aug",
    weekday: "Tuesday",
    window: "2:40 PM – 5:10 PM",
    blocks: [
      { time: "2:40 – 3:40 PM", title: "The Blacktie Protocol & The Grid", eventSlugs: ["blacktie-protocol", "the-grid"], eventRoundLabels: ["Round 1", "Round 2"], venue: "Classroom A / Gaming venue", startsAt: "2026-08-18T14:40:00+05:30", endsAt: "2026-08-18T15:40:00+05:30" },
      { time: "3:40 – 3:45 PM", title: "Break", isBreak: true, startsAt: "2026-08-18T15:40:00+05:30", endsAt: "2026-08-18T15:45:00+05:30" },
      { time: "3:45 – 5:10 PM", title: "Blackout Build & CyberPitch", eventSlugs: ["blackout-build", "cyberpitch"], eventRoundLabels: ["Round 2", "Round 1"], venue: "Classroom C / Classroom B", startsAt: "2026-08-18T15:45:00+05:30", endsAt: "2026-08-18T17:10:00+05:30" },
    ],
  },
  {
    dayLabel: "Day 3",
    date: "19 Aug",
    weekday: "Wednesday",
    window: "2:40 PM – 5:10 PM",
    blocks: [
      { time: "2:40 – 3:40 PM", title: "Mind Games — Round 2", eventSlugs: ["cortex-vortex", "ghost-override"], eventRoundLabels: ["Round 2", "Round 2"], venue: "Classroom A / B", startsAt: "2026-08-19T14:40:00+05:30", endsAt: "2026-08-19T15:40:00+05:30" },
      { time: "3:40 – 4:00 PM", title: "Break", isBreak: true, startsAt: "2026-08-19T15:40:00+05:30", endsAt: "2026-08-19T16:00:00+05:30" },
      { time: "4:00 – 5:10 PM", title: "Manhunt — Round 1", eventSlugs: ["room-zero", "the-trace"], eventRoundLabels: ["Round 1", "Round 1"], venue: "Classroom / Basketball Court", startsAt: "2026-08-19T16:00:00+05:30", endsAt: "2026-08-19T17:10:00+05:30" },
    ],
  },
  {
    dayLabel: "Day 4",
    date: "20 Aug",
    weekday: "Thursday",
    window: "2:40 PM – 5:10 PM",
    blocks: [
      { time: "2:40 – 5:10 PM", title: "Sleeper Cell", eventSlug: "sleeper-cell", venue: "Campus-wide", startsAt: "2026-08-20T14:40:00+05:30", endsAt: "2026-08-20T17:10:00+05:30" },
    ],
  },
  {
    dayLabel: "Day 5",
    date: "21 Aug",
    weekday: "Friday",
    window: "2:40 PM – 5:10 PM",
    blocks: [
      // One long paired activity, no filler breaks — a proper staggered-heat
      // narrowing round genuinely fills an afternoon on its own.
      { time: "2:40 – 5:10 PM", title: "Manhunt — Round 2", eventSlugs: ["room-zero", "the-trace"], eventRoundLabels: ["Round 2", "Round 2"], venue: "Classroom / Basketball Court", startsAt: "2026-08-21T14:40:00+05:30", endsAt: "2026-08-21T17:10:00+05:30" },
    ],
  },
  {
    dayLabel: "Day 6",
    date: "22 Aug",
    weekday: "Saturday",
    window: "10:00 AM – 4:30 PM",
    blocks: [
      { time: "10:00 – 12:50 PM", title: "Room Zero Grand Finale & CyberPitch", eventSlugs: ["room-zero", "cyberpitch"], eventRoundLabels: ["Grand Finale", "Round 2"], venue: "Classroom / Classroom B", startsAt: "2026-08-22T10:00:00+05:30", endsAt: "2026-08-22T12:50:00+05:30" },
      { time: "12:50 – 1:30 PM", title: "Lunch Break", isBreak: true, startsAt: "2026-08-22T12:50:00+05:30", endsAt: "2026-08-22T13:30:00+05:30" },
      { time: "1:30 – 4:30 PM", title: "The Blacktie Protocol & The Trace", eventSlugs: ["blacktie-protocol", "the-trace"], eventRoundLabels: ["Round 2", "Round 3"], venue: "Classroom A / Basketball Court", startsAt: "2026-08-22T13:30:00+05:30", endsAt: "2026-08-22T16:30:00+05:30" },
    ],
  },
];

export const finaleSchedule: ScheduleBlock[] = [
  { time: "10:00 – 11:35 AM", title: "CyberPitch — Round 3", eventSlug: "cyberpitch", venue: "Stage", startsAt: "2026-08-24T10:00:00+05:30", endsAt: "2026-08-24T11:35:00+05:30" },
  { time: "11:35 – 11:50 AM", title: "Break", isBreak: true, startsAt: "2026-08-24T11:35:00+05:30", endsAt: "2026-08-24T11:50:00+05:30" },
  { time: "11:50 AM – 1:10 PM", title: "Cortex Vortex — Round 3", eventSlug: "cortex-vortex", venue: "Stage", startsAt: "2026-08-24T11:50:00+05:30", endsAt: "2026-08-24T13:10:00+05:30" },
  { time: "1:10 – 1:55 PM", title: "Lunch Break", isBreak: true, startsAt: "2026-08-24T13:10:00+05:30", endsAt: "2026-08-24T13:55:00+05:30" },
  { time: "1:55 – 2:10 PM", title: "Break", isBreak: true, startsAt: "2026-08-24T13:55:00+05:30", endsAt: "2026-08-24T14:10:00+05:30" },
  { time: "2:10 – 3:35 PM", title: "The Blacktie Protocol — Round 3", eventSlug: "blacktie-protocol", venue: "Stage", startsAt: "2026-08-24T14:10:00+05:30", endsAt: "2026-08-24T15:35:00+05:30" },
  { time: "3:35 – 3:50 PM", title: "Break", isBreak: true, startsAt: "2026-08-24T15:35:00+05:30", endsAt: "2026-08-24T15:50:00+05:30" },
  { time: "3:50 – 5:30 PM", title: "Closing Ceremony", venue: "Stage", isBreak: true, startsAt: "2026-08-24T15:50:00+05:30", endsAt: "2026-08-24T17:30:00+05:30" },
];

/** Returns the schedule block active right now, if any. */
export function getLiveBlock(now: Date = new Date()): ScheduleBlock | null {
  const all = [...onGroundWeek.flatMap((d) => d.blocks), ...finaleSchedule];
  const t = now.getTime();
  return (
    all.find((b) => {
      if (!b.startsAt || !b.endsAt) return false;
      const start = new Date(b.startsAt).getTime();
      const end = new Date(b.endsAt).getTime();
      return t >= start && t < end;
    }) ?? null
  );
}

/** Every locked schedule block (across all days) that includes this event — a multi-round event has one per round. */
export function getEventScheduleBlocks(eventSlug: string): { date: string; time: string; venue?: string }[] {
  const days = onGroundWeek.map((d) => ({ date: d.date, blocks: d.blocks }));
  days.push({ date: "24 Aug", blocks: finaleSchedule });

  const result: { date: string; time: string; venue?: string }[] = [];
  for (const day of days) {
    for (const b of day.blocks) {
      const matches = b.eventSlug === eventSlug || b.eventSlugs?.includes(eventSlug);
      if (matches) result.push({ date: day.date, time: b.time, venue: b.venue });
    }
  }
  return result;
}

/** The venue string is a single combined field on paired blocks (e.g. "406 / B2", matching eventSlugs order) — pick out this one event's half. */
export function venueForEvent(eventSlug: string, block: { eventSlug?: string; eventSlugs?: [string, string]; venue?: string }): string {
  if (!block.venue) return "TBD";
  if (!block.eventSlugs) return block.venue;
  const parts = block.venue.split(" / ");
  const i = block.eventSlugs.indexOf(eventSlug);
  return parts[i] ?? block.venue;
}

/** Earliest startsAt across every round of this event — the "start time" registration locks 24h ahead of. */
export function firstRoundStartsAt(eventSlug: string): Date | null {
  const all = [...onGroundWeek.flatMap((d) => d.blocks), ...finaleSchedule];
  const matches = all.filter((b) => (b.eventSlug === eventSlug || b.eventSlugs?.includes(eventSlug)) && b.startsAt);
  if (matches.length === 0) return null;
  const times = matches.map((b) => new Date(b.startsAt!).getTime());
  return new Date(Math.min(...times));
}

/** The first-round block itself (date label + time + venue) — used for lock-notification emails. */
export function firstRoundBlock(eventSlug: string): { date: string; time: string; venue: string } | null {
  const days = onGroundWeek.map((d) => ({ date: d.date, blocks: d.blocks }));
  days.push({ date: "24 Aug", blocks: finaleSchedule });

  let best: { date: string; time: string; venue: string; startsAt: number } | null = null;
  for (const day of days) {
    for (const b of day.blocks) {
      const matches = (b.eventSlug === eventSlug || b.eventSlugs?.includes(eventSlug)) && b.startsAt;
      if (!matches) continue;
      const startsAt = new Date(b.startsAt!).getTime();
      if (!best || startsAt < best.startsAt) {
        best = { date: day.date, time: b.time, venue: venueForEvent(eventSlug, b), startsAt };
      }
    }
  }
  return best ? { date: best.date, time: best.time, venue: best.venue } : null;
}
