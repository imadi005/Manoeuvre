import Link from "next/link";
import { onGroundWeek, finaleSchedule, type ScheduleBlock } from "@/lib/schedule";
import { events } from "@/lib/data";

function eventName(slug: string): string {
  return events.find((e) => e.slug === slug)?.name ?? slug;
}

const AXIS_START_MIN = 10 * 60; // 10:00 AM — earliest any day starts
const AXIS_END_MIN = 18 * 60; // 6:00 PM — Finale's Closing Ceremony runs to 5:30 PM
const AXIS_SPAN = AXIS_END_MIN - AXIS_START_MIN;
const HOURS = Array.from({ length: 9 }, (_, i) => 10 + i); // 10..18

interface GridDay {
  date: string;
  weekday: string;
  blocks: ScheduleBlock[];
  isOff?: boolean;
}

const gridDays: GridDay[] = [
  ...onGroundWeek.map((d) => ({ date: d.date, weekday: d.weekday, blocks: d.blocks })),
  { date: "23 Aug", weekday: "Sunday", blocks: [], isOff: true },
  { date: "24 Aug", weekday: "Monday", blocks: finaleSchedule },
];

function minutesOfDay(iso: string): number {
  const timePart = iso.split("T")[1];
  const [h, m] = timePart.split(":").map(Number);
  return h * 60 + m;
}

function blockPosition(b: ScheduleBlock) {
  if (!b.startsAt || !b.endsAt) return null;
  const start = minutesOfDay(b.startsAt);
  const end = minutesOfDay(b.endsAt);
  // Strictly proportional to real duration — never inflated past the actual
  // end time, or a short block could visually spill into the next one.
  const top = ((start - AXIS_START_MIN) / AXIS_SPAN) * 100;
  const height = ((end - start) / AXIS_SPAN) * 100;
  return { style: { top: `${top}%`, height: `${height}%` }, durationMin: end - start };
}

function BlockContent({ b }: { b: ScheduleBlock }) {
  const pos = blockPosition(b);
  const isStage = b.venue === "Stage";
  const isShort = (pos?.durationMin ?? 999) < 30;
  const colorClass = b.isBreak
    ? "border-panel-line/60 bg-panel/30 text-fog-dim"
    : isStage
      ? "border-yellow/60 bg-yellow/10 text-yellow"
      : "border-cyan/50 bg-cyan/10 text-cyan";
  const style = { ...(pos?.style ?? {}), minHeight: isShort ? "16px" : "26px" };

  if (b.eventSlugs) {
    const [slugA, slugB] = b.eventSlugs;
    const [roundA, roundB] = b.eventRoundLabels ?? ["", ""];
    return (
      <div className={`absolute inset-x-0.5 z-10 flex divide-x divide-current/20 border ${colorClass}`} style={style}>
        {[
          [slugA, roundA],
          [slugB, roundB],
        ].map(([slug, round]) => (
          <Link
            key={slug}
            href={`/events/${slug}`}
            className="flex-1 overflow-hidden px-1 py-0.5 text-left transition-colors hover:z-20 hover:bg-panel hover:text-magenta"
          >
            {!isShort && (
              <p className="font-mono-fx text-[7px] leading-tight opacity-80 sm:text-[8px]">{b.time}</p>
            )}
            <p className="whitespace-normal break-words font-body text-[8px] font-semibold leading-tight text-fog sm:text-[9px]">
              {eventName(slug)}
            </p>
            {round && !isShort && (
              <p className="whitespace-normal font-mono-fx text-[7px] uppercase leading-tight opacity-70 sm:text-[8px]">
                {round}
              </p>
            )}
          </Link>
        ))}
      </div>
    );
  }

  const inner = (
    <>
      {!isShort && (
        <p className="font-mono-fx text-[8px] leading-tight opacity-80 sm:text-[9px]">{b.time}</p>
      )}
      <p className="whitespace-normal break-words font-body text-[9px] font-semibold leading-tight text-fog sm:text-[10px]">
        {b.title}
      </p>
    </>
  );

  const className = `absolute inset-x-0.5 z-10 border px-1.5 py-0.5 text-left transition-transform ${colorClass} ${
    b.eventSlug ? "hover:z-20 hover:scale-[1.03] hover:border-magenta hover:bg-panel" : ""
  }`;

  return b.eventSlug ? (
    <Link href={`/events/${b.eventSlug}`} className={className} style={style}>
      {inner}
    </Link>
  ) : (
    <div className={className} style={style}>
      {inner}
    </div>
  );
}

function DesktopGrid() {
  return (
    <div className="max-md:overflow-x-auto">
      <div className="flex gap-1.5 max-md:min-w-[1080px]">
        <div className="w-10 flex-shrink-0">
          <div className="h-12" />
          <div className="relative" style={{ height: 640 }}>
            {HOURS.map((h) => (
              <span
                key={h}
                className="absolute -translate-y-1/2 font-mono-fx text-[9px] text-fog-dim"
                style={{ top: `${((h * 60 - AXIS_START_MIN) / AXIS_SPAN) * 100}%` }}
              >
                {h > 12 ? h - 12 : h}
                {h >= 12 ? "PM" : "AM"}
              </span>
            ))}
          </div>
        </div>

        {gridDays.map((day) => (
          <div key={day.date} className="min-w-0 max-md:w-[130px] max-md:flex-shrink-0 md:flex-1">
            <div className="flex h-12 flex-col items-center justify-center border-b border-panel-line">
              <p className="font-display text-xs font-bold uppercase text-fog">{day.date}</p>
              <p className="font-mono-fx text-[9px] uppercase text-fog-dim">{day.weekday}</p>
            </div>
            <div className="relative border-l border-panel-line" style={{ height: 640 }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-panel-line/40"
                  style={{ top: `${((h * 60 - AXIS_START_MIN) / AXIS_SPAN) * 100}%` }}
                />
              ))}
              {day.isOff ? (
                <p className="absolute inset-0 flex items-center justify-center px-1 text-center font-mono-fx text-[9px] uppercase text-fog-dim">
                  Day off
                </p>
              ) : (
                day.blocks.map((b, i) => <BlockContent key={i} b={b} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScheduleGrid() {
  return <DesktopGrid />;
}
