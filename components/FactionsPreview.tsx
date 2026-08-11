import Reveal from "./Reveal";
import FactionTerritoryMap from "./FactionTerritoryMap";

export default function FactionsPreview() {
  return (
    <section id="factions" className="relative border-t border-panel-line bg-void-deep py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mb-14 flex flex-col items-center text-center">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-magenta text-glow-magenta">
            // Eight Factions
          </p>
          <h2 className="font-display mt-3 text-3xl font-bold uppercase text-fog sm:text-4xl">
            The Grid <span className="text-yellow text-glow-yellow">Already Chose For You.</span>
          </h2>
          <p className="mt-4 max-w-xl font-body text-sm text-fog">
            The moment you&apos;re in, you&apos;re sorted — no applications,
            no picking sides. Eight factions, each run by its own
            coordinators, and every point you win feeds straight into your
            faction&apos;s standing on the board.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <FactionTerritoryMap />
        </Reveal>
      </div>
    </section>
  );
}
