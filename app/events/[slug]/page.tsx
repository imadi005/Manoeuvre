import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { events } from "@/lib/data";

const glowText: Record<string, string> = {
  magenta: "text-magenta text-glow-magenta",
  cyan: "text-cyan text-glow-cyan",
  yellow: "text-yellow text-glow-yellow",
};

const glowBorder: Record<string, string> = {
  magenta: "border-magenta/40",
  cyan: "border-cyan/40",
  yellow: "border-yellow/40",
};

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = events.find((e) => e.slug === slug);
  if (!event) notFound();

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl">
          <Reveal>
            <Link
              href="/#events"
              className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-cyan"
            >
              ← All events
            </Link>

            <p className="mt-6 font-mono-fx text-xs uppercase tracking-[0.4em] text-fog-dim">
              {event.category}
            </p>
            <h1
              className={`font-display mt-2 text-4xl font-black uppercase leading-tight sm:text-5xl ${glowText[event.glow]}`}
            >
              {event.name}
            </h1>
            <p className="mt-4 font-body text-base text-fog sm:text-lg">
              {event.tagline}
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-12 space-y-4">
            {event.briefing.map((p, i) => (
              <p key={i} className="font-body text-sm leading-relaxed text-fog sm:text-base">
                {p}
              </p>
            ))}
          </Reveal>

          <Reveal delay={0.2} className={`mt-12 border ${glowBorder[event.glow]} bg-panel/50 p-6`}>
            <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Format
            </p>
            <ul className="mt-4 space-y-3">
              {event.format.map((f, i) => (
                <li key={i} className="flex gap-3 font-body text-sm text-fog sm:text-base">
                  <span className={glowText[event.glow]}>▸</span>
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.3} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Per Faction", value: `${event.participantsPerFaction}${event.allowsExtraSquads ? "+" : ""}` },
              { label: "Rounds", value: String(event.rounds) },
              {
                label: "Points",
                value: event.pointsTier.points !== null ? `${event.pointsTier.label} — ${event.pointsTier.points}` : event.pointsTier.label,
              },
            ].map((s) => (
              <div key={s.label} className="border border-panel-line bg-panel/40 p-4 text-center">
                <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                  {s.label}
                </p>
                <p className="mt-2 font-display text-sm uppercase text-fog">{s.value}</p>
              </div>
            ))}
          </Reveal>

          <Reveal delay={0.35} className="mt-10 font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
            Full rules, exact timings, and participant rosters go live once
            faction coordinators complete entries.
          </Reveal>
        </div>
      </main>
      <Footer />
    </>
  );
}
