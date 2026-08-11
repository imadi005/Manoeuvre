"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { events, MAX_EVENTS_PER_STUDENT, SLOTS_PER_FACTION } from "@/lib/data";
import { findConflict } from "@/lib/scheduleConflicts";

type ActionResult = { error: string | null };

export async function addRegistration(studentId: string, eventSlug: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "faction_head") return { error: "Not authorized." };

  const event = events.find((e) => e.slug === eventSlug);
  if (!event) return { error: "Unknown event." };

  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, faction_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.faction_id !== session.factionId) {
    return { error: "That student isn't in your faction." };
  }

  const { data: studentRegs } = await supabase
    .from("event_registrations")
    .select("event_slug")
    .eq("student_id", studentId);
  const currentSlugs = (studentRegs ?? []).map((r) => r.event_slug);

  if (currentSlugs.length >= MAX_EVENTS_PER_STUDENT) {
    return { error: `This student is already in ${MAX_EVENTS_PER_STUDENT} events (the max).` };
  }

  if (currentSlugs.includes(eventSlug)) return { error: "Already registered for this event." };

  const conflictSlug = findConflict(eventSlug, currentSlugs);
  if (conflictSlug) {
    const conflictName = events.find((e) => e.slug === conflictSlug)?.name ?? conflictSlug;
    return { error: `Time conflict — already in ${conflictName}, which runs at the same time as ${event.name}.` };
  }

  const { count: factionTotal } = await supabase
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("faction_id", session.factionId);
  if ((factionTotal ?? 0) >= SLOTS_PER_FACTION) {
    return { error: `Your faction has used all ${SLOTS_PER_FACTION} slots.` };
  }

  if (!event.allowsExtraSquads) {
    const { count: eventFactionCount } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("faction_id", session.factionId)
      .eq("event_slug", eventSlug);
    if ((eventFactionCount ?? 0) >= event.participantsPerFaction) {
      return { error: `${event.name} is full for your faction (${event.participantsPerFaction} slots).` };
    }
  }

  const { error } = await supabase.from("event_registrations").insert({
    student_id: studentId,
    faction_id: session.factionId,
    event_slug: eventSlug,
    registered_by: session.id,
  });
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/faction-head");
  return { error: null };
}

export async function removeRegistration(registrationId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.role !== "faction_head") return { error: "Not authorized." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("event_registrations")
    .delete()
    .eq("id", registrationId)
    .eq("faction_id", session.factionId);
  if (error) return { error: "Something went wrong. Try again." };

  revalidatePath("/dashboard/faction-head");
  return { error: null };
}
