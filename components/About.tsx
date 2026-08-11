import Reveal from "./Reveal";

const stats = [
  { value: "350+", label: "Operatives" },
  { value: "08", label: "Factions" },
  { value: "10", label: "Events" },
  { value: "07", label: "Days" },
];

export default function About() {
  return (
    <section id="about" className="relative border-t border-panel-line bg-void-deep px-5 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-14 text-center">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-cyan text-glow-cyan">
            // Briefing
          </p>
          <h2 className="font-display mt-3 text-3xl font-bold uppercase text-fog sm:text-4xl">
            The City Is <span className="text-magenta text-glow-magenta">Divided</span>
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mx-auto max-w-3xl text-center font-body text-sm leading-relaxed text-fog sm:text-base">
            You are all divided. The moment you enter the grid, you&apos;re
            scattered into eight factions, chosen by chance, not choice. For
            one week, faction is
            everything. Your coordinators draft you into the events that suit
            you, your points feed a single faction score, and every faction is
            gunning for the same seat at the top of the board. There are no
            neutral players in MANŒUVRE. Pick your lane, back your faction, and
            survive the week — quizzes, code, pitches, and a few games that
            reward pure paranoia. The board resets each edition. This is the
            21st time the city has done this, and the network never forgets a
            winner.
          </p>
        </Reveal>

        <Reveal
          delay={0.2}
          className="mt-16 grid grid-cols-2 gap-px overflow-hidden border border-panel-line bg-panel-line sm:grid-cols-4"
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1 bg-void-deep py-8"
            >
              <span className="font-display text-3xl font-bold text-yellow text-glow-yellow sm:text-4xl">
                {s.value}
              </span>
              <span className="font-mono-fx text-[11px] uppercase tracking-widest text-fog-dim">
                {s.label}
              </span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
