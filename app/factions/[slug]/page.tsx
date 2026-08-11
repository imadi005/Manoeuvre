import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import RosterList from "@/components/RosterList";
import FactionHeroArt from "@/components/FactionHeroArt";
import { factions } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 60;

export function generateStaticParams() {
  return factions.map((f) => ({ slug: f.slug }));
}

export default async function FactionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const faction = factions.find((f) => f.slug === slug);
  if (!faction) notFound();

  const supabase = createAdminClient();
  const { data: dbFaction } = await supabase
    .from("factions")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  const { data: roster } = dbFaction
    ? await supabase
        .from("students")
        .select("roll_number, name")
        .eq("faction_id", dbFaction.id)
        .order("name")
    : { data: [] };

  const operativeCount = roster?.length ?? 0;
  const accentStyle = { "--accent": faction.accent } as React.CSSProperties;

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl" style={accentStyle}>
          <Reveal>
            <Link
              href="/#factions"
              className="hover-text-glow-accent font-mono-fx text-xs uppercase tracking-widest text-fog-dim"
            >
              ← All factions
            </Link>
          </Reveal>

          <Reveal delay={0.08}>
            <FactionHeroArt logo={faction.logo} name={faction.name} accent={faction.accent} />
          </Reveal>

          <Reveal delay={0.15} className="hover-glow-accent mt-8 border border-panel-line bg-panel/50 p-6">
            <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Coordinators
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-8">
              {faction.heads.map((h) => (
                <p key={h} className="font-display text-lg uppercase text-fog">
                  {h}
                </p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.25} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Operatives", value: String(operativeCount) },
              { label: "Faction Score", value: "—" },
              { label: "Rank", value: "TBD" },
            ].map((s) => (
              <div key={s.label} className="border border-panel-line bg-panel/40 p-4 text-center">
                <p className="font-mono-fx text-[10px] uppercase tracking-widest text-fog-dim">
                  {s.label}
                </p>
                <p className="text-glow-accent mt-2 font-display text-xl uppercase">{s.value}</p>
              </div>
            ))}
          </Reveal>

          <Reveal delay={0.3} className="mt-14">
            <p className="font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Roster — {operativeCount} Operatives
            </p>

            {roster && roster.length > 0 ? (
              <div className="mt-5">
                <RosterList roster={roster} accent={faction.accent} />
              </div>
            ) : (
              <p className="mt-4 font-body text-sm text-fog-dim">
                Roster not available yet.
              </p>
            )}
          </Reveal>
        </div>
      </main>
      <Footer />
    </>
  );
}
