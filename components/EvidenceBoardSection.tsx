import Reveal from "./Reveal";
import EvidenceBoard from "./EvidenceBoard";

export default function EvidenceBoardSection() {
  return (
    <section id="events" className="relative border-t border-panel-line bg-void-deep px-5 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-10 flex flex-col items-center text-center">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-yellow text-glow-yellow">
            // Ten Protocols
          </p>
          <h2 className="font-display mt-3 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Choose Your <span className="text-cyan text-glow-cyan">Battlefield.</span>
          </h2>
          <p className="mt-4 max-w-xl font-body text-sm text-fog">
            Ten dossiers, pinned and connected. Tap any one to pull the full
            file — rules, timings, and rosters go live on each event page
            closer to the fest.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <EvidenceBoard />
        </Reveal>
      </div>
    </section>
  );
}
