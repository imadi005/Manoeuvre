import Reveal from "./Reveal";
import ScheduleTeaser from "./ScheduleTeaser";

export default function ScheduleSection() {
  return (
    <section id="schedule" className="relative border-t border-panel-line bg-void px-5 py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal className="mb-10 flex flex-col items-center text-center">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-cyan text-glow-cyan">
            // Seven Days
          </p>
          <h2 className="font-display mt-3 text-3xl font-bold uppercase text-fog sm:text-4xl">
            One Network. <span className="text-yellow text-glow-yellow">Zero Clashes.</span>
          </h2>
          <p className="mt-4 max-w-xl font-body text-sm text-fog">
            Every round, every day, mapped out so nothing you&apos;re in ever
            overlaps. Flip through the week below.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <ScheduleTeaser />
        </Reveal>
      </div>
    </section>
  );
}
