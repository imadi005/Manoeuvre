import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import ScheduleGrid from "@/components/ScheduleGrid";

export default function SchedulePage() {
  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl">
          <Reveal className="text-center">
            <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-cyan text-glow-cyan">
              // Master Schedule
            </p>
            <h1 className="font-display mt-3 text-3xl font-black uppercase text-fog sm:text-4xl">
              Seven Days. <span className="text-yellow text-glow-yellow">One Network.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl font-body text-sm text-fog-dim">
              Similar events run in parallel across separate venues, so no
              single squad sweeps every slot. Tap any block for details.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mt-12">
            <ScheduleGrid />
          </Reveal>
        </div>
      </main>
      <Footer />
    </>
  );
}
