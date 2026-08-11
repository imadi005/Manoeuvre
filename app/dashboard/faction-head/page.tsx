import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import RegistrationBoard from "@/components/RegistrationBoard";

export default async function FactionHeadDashboard() {
  const session = await getSession();
  if (!session || session.role !== "faction_head") redirect("/login");
  if (session.mustReset) redirect("/reset-password");

  const supabase = createAdminClient();
  const { data: faction } = await supabase
    .from("factions")
    .select("name")
    .eq("id", session.factionId)
    .maybeSingle();

  const { data: studentRows } = await supabase
    .from("students")
    .select("id, name, roll_number")
    .eq("faction_id", session.factionId)
    .order("name");

  const { data: registrationRows } = await supabase
    .from("event_registrations")
    .select("id, event_slug, student_id, students(name, roll_number)")
    .eq("faction_id", session.factionId);

  type RegRow = {
    id: string;
    event_slug: string;
    student_id: string;
    students: { name: string; roll_number: string } | { name: string; roll_number: string }[] | null;
  };

  const regs = (registrationRows ?? []) as unknown as RegRow[];

  const eventCountByStudent = new Map<string, number>();
  const eventSlugsByStudent = new Map<string, string[]>();
  for (const r of regs) {
    eventCountByStudent.set(r.student_id, (eventCountByStudent.get(r.student_id) ?? 0) + 1);
    if (!eventSlugsByStudent.has(r.student_id)) eventSlugsByStudent.set(r.student_id, []);
    eventSlugsByStudent.get(r.student_id)!.push(r.event_slug);
  }

  const students = (studentRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    rollNumber: s.roll_number,
    eventCount: eventCountByStudent.get(s.id) ?? 0,
    eventSlugs: eventSlugsByStudent.get(s.id) ?? [],
  }));

  const registrationsByEvent: Record<
    string,
    { id: string; studentId: string; name: string; rollNumber: string }[]
  > = {};
  for (const r of regs) {
    const info = Array.isArray(r.students) ? r.students[0] : r.students;
    if (!registrationsByEvent[r.event_slug]) registrationsByEvent[r.event_slug] = [];
    registrationsByEvent[r.event_slug].push({
      id: r.id,
      studentId: r.student_id,
      name: info?.name ?? "—",
      rollNumber: info?.roll_number ?? "—",
    });
  }

  return (
    <>
      <Navbar />
      <main className="scanlines relative min-h-screen bg-void px-5 pb-24 pt-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-5xl">
          <p className="font-mono-fx text-xs uppercase tracking-[0.4em] text-magenta text-glow-magenta">
            // Command Terminal
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold uppercase text-fog sm:text-4xl">
            Welcome, {session.name}
          </h1>
          <p className="mt-3 font-mono-fx text-sm uppercase tracking-widest text-fog-dim">
            Faction: {faction?.name ?? "—"} · {students.length} operatives
          </p>

          <div className="mt-10">
            <p className="mb-4 font-mono-fx text-xs uppercase tracking-[0.35em] text-fog-dim">
              // Enter Students Into Events
            </p>
            <RegistrationBoard
              students={students}
              registrationsByEvent={registrationsByEvent}
              factionTotalUsed={regs.length}
            />
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
