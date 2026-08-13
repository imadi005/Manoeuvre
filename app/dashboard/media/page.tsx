import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { events } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PhotoUploadForm from "@/components/PhotoUploadForm";

export default async function MediaDashboard() {
  const session = await getSession();
  if (!session || session.role !== "media") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const supabase = createAdminClient();

  const { data: publishedResults } = await supabase
    .from("event_results")
    .select("event_slug")
    .eq("status", "published");

  const closedSlugs = (publishedResults ?? []).map((r) => r.event_slug);

  const { data: photoRows } = closedSlugs.length
    ? await supabase
        .from("event_photos")
        .select("id, event_slug, storage_path, photo_type")
        .in("event_slug", closedSlugs)
    : { data: [] };

  const { data: notifiedRows } = closedSlugs.length
    ? await supabase
        .from("notifications")
        .select("type, message")
        .eq("type", "documentation_ready")
    : { data: [] };
  const notifiedSlugs = new Set(
    (notifiedRows ?? [])
      .map((n) => events.find((e) => n.message.includes(e.name))?.slug)
      .filter(Boolean)
  );

  const photosByEvent: Record<string, { id: string; photoType: "geotagged" | "normal"; url: string; name: string }[]> = {};
  for (const p of photoRows ?? []) {
    if (!photosByEvent[p.event_slug]) photosByEvent[p.event_slug] = [];
    const { data: pub } = supabase.storage.from("event-photos").getPublicUrl(p.storage_path);
    photosByEvent[p.event_slug].push({
      id: p.id,
      photoType: p.photo_type as "geotagged" | "normal",
      url: pub.publicUrl,
      name: p.storage_path,
    });
  }

  const closedEvents = events.filter((e) => closedSlugs.includes(e.slug));

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-5xl">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-cyan text-glow-cyan">
            // Media Team Terminal
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Welcome, {session.name}
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            Upload geotagged &amp; normal photos for closed events
          </p>

          <div className="mt-10 flex flex-col gap-6">
            {closedEvents.length === 0 && (
              <p className="font-body text-sm text-fog-dim">No events closed yet — nothing to upload.</p>
            )}
            {closedEvents.map((e) => (
              <PhotoUploadForm
                key={e.slug}
                eventSlug={e.slug}
                eventName={e.name}
                photos={photosByEvent[e.slug] ?? []}
                documentationNotified={notifiedSlugs.has(e.slug)}
              />
            ))}
          </div>

          <form action={logout} className="mt-10">
            <button className="font-mono-fx text-xs uppercase tracking-widest text-fog-dim transition-colors hover:text-magenta">
              Log out →
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
