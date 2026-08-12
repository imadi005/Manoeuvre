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
// run 2:00 – 4:30 PM; Saturday (22 Aug) runs 10:00 AM – 4:30 PM; the
// Finale (24 Aug) runs 10:00 AM – 5:30 PM (Closing Ceremony gets the
// extra hour).
//
// Manual timing swaps requested post-launch (each event keeps its own
// round number and venue — only the clock slot moves, so the thematic
// pairs above no longer hold cleanly on these three days):
//   18 Aug — CyberPitch (R1) <-> The Grid (R2)
//   22 Aug — CyberPitch (R2) <-> The Trace (R3)
//   24 Aug — The Blacktie Protocol / "IT Manager" (R3) <-> CyberPitch (R3)

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
    window: "2:00 PM – 4:30 PM",
    blocks: [
      { time: "2:00 – 2:50 PM", title: "Mind Games — Round 1", eventSlugs: ["cortex-vortex", "ghost-override"], eventRoundLabels: ["Round 1", "Round 1"], venue: "Classroom A / B", startsAt: "2026-08-17T14:00:00+05:30", endsAt: "2026-08-17T14:50:00+05:30" },
      { time: "2:50 – 3:00 PM", title: "Break", isBreak: true, startsAt: "2026-08-17T14:50:00+05:30", endsAt: "2026-08-17T15:00:00+05:30" },
      { time: "3:00 – 4:30 PM", title: "Screens — Round 1", eventSlugs: ["blackout-build", "the-grid"], eventRoundLabels: ["Round 1", "Round 1"], venue: "Classroom C / Gaming venue", startsAt: "2026-08-17T15:00:00+05:30", endsAt: "2026-08-17T16:30:00+05:30" },
    ],
  },
  {
    dayLabel: "Day 2",
    date: "18 Aug",
    weekday: "Tuesday",
    window: "2:00 PM – 4:30 PM",
    blocks: [
      { time: "2:00 – 3:00 PM", title: "The Blacktie Protocol & The Grid", eventSlugs: ["blacktie-protocol", "the-grid"], eventRoundLabels: ["Round 1", "Round 2"], venue: "Classroom A / Gaming venue", startsAt: "2026-08-18T14:00:00+05:30", endsAt: "2026-08-18T15:00:00+05:30" },
      { time: "3:00 – 3:05 PM", title: "Break", isBreak: true, startsAt: "2026-08-18T15:00:00+05:30", endsAt: "2026-08-18T15:05:00+05:30" },
      { time: "3:05 – 4:30 PM", title: "Blackout Build & CyberPitch", eventSlugs: ["blackout-build", "cyberpitch"], eventRoundLabels: ["Round 2", "Round 1"], venue: "Classroom C / Classroom B", startsAt: "2026-08-18T15:05:00+05:30", endsAt: "2026-08-18T16:30:00+05:30" },
    ],
  },
  {
    dayLabel: "Day 3",
    date: "19 Aug",
    weekday: "Wednesday",
    window: "2:00 PM – 4:30 PM",
    blocks: [
      { time: "2:00 – 3:00 PM", title: "Mind Games — Round 2", eventSlugs: ["cortex-vortex", "ghost-override"], eventRoundLabels: ["Round 2", "Round 2"], venue: "Classroom A / B", startsAt: "2026-08-19T14:00:00+05:30", endsAt: "2026-08-19T15:00:00+05:30" },
      { time: "3:00 – 3:20 PM", title: "Break", isBreak: true, startsAt: "2026-08-19T15:00:00+05:30", endsAt: "2026-08-19T15:20:00+05:30" },
      { time: "3:20 – 4:30 PM", title: "Manhunt — Round 1", eventSlugs: ["room-zero", "the-trace"], eventRoundLabels: ["Round 1", "Round 1"], venue: "Classroom / Basketball Court", startsAt: "2026-08-19T15:20:00+05:30", endsAt: "2026-08-19T16:30:00+05:30" },
    ],
  },
  {
    dayLabel: "Day 4",
    date: "20 Aug",
    weekday: "Thursday",
    window: "2:00 PM – 4:30 PM",
    blocks: [
      { time: "2:00 – 4:30 PM", title: "Sleeper Cell", eventSlug: "sleeper-cell", venue: "Campus-wide", startsAt: "2026-08-20T14:00:00+05:30", endsAt: "2026-08-20T16:30:00+05:30" },
    ],
  },
  {
    dayLabel: "Day 5",
    date: "21 Aug",
    weekday: "Friday",
    window: "2:00 PM – 4:30 PM",
    blocks: [
      // One long paired activity, no filler breaks — a proper staggered-heat
      // narrowing round genuinely fills an afternoon on its own.
      { time: "2:00 – 4:30 PM", title: "Manhunt — Round 2", eventSlugs: ["room-zero", "the-trace"], eventRoundLabels: ["Round 2", "Round 2"], venue: "Classroom / Basketball Court", startsAt: "2026-08-21T14:00:00+05:30", endsAt: "2026-08-21T16:30:00+05:30" },
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
