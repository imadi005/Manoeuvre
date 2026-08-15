import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { events } from "@/lib/data";
import { isRegistrationLocked } from "@/lib/eventLock";
import { notifyEventLocked } from "@/lib/notify";

/**
 * Runs every 15 minutes (see vercel.json). For every event whose 24h-before-
 * first-round cutoff has just passed and hasn't been notified yet, sends the
 * lock-confirmation emails and records it in event_locks so it never fires
 * twice. Idempotent by design — safe if two runs overlap or one fails
 * mid-way, since each event is claimed via a single-row insert before its
 * emails are sent.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results: { slug: string; status: string }[] = [];

  for (const event of events) {
    if (!isRegistrationLocked(event.slug)) continue;

    const { data: existing } = await supabase
      .from("event_locks")
      .select("event_slug")
      .eq("event_slug", event.slug)
      .maybeSingle();
    if (existing) continue;

    const { error: claimError } = await supabase.from("event_locks").insert({ event_slug: event.slug });
    if (claimError) {
      // Another run claimed it first (race) -- skip, not an error.
      results.push({ slug: event.slug, status: "already_claimed" });
      continue;
    }

    try {
      await notifyEventLocked(event.slug);
      await supabase.from("event_locks").update({ notified_at: new Date().toISOString() }).eq("event_slug", event.slug);
      results.push({ slug: event.slug, status: "locked_and_notified" });
    } catch (e) {
      results.push({ slug: event.slug, status: `notify_failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  return NextResponse.json({ checked: events.length, results });
}
