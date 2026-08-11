import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { factions } from "@/lib/data";
import FactionReveal from "@/components/FactionReveal";

export default async function RevealPage() {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/login");
  if (session.mustReset) redirect("/reset-password");
  if (!session.factionId) redirect("/dashboard/student");

  const supabase = createAdminClient();
  const { data: dbFaction } = await supabase
    .from("factions")
    .select("slug")
    .eq("id", session.factionId)
    .maybeSingle();

  const faction = dbFaction ? factions.find((f) => f.slug === dbFaction.slug) : null;
  if (!faction) redirect("/dashboard/student");

  return <FactionReveal faction={faction} studentName={session.name} />;
}
