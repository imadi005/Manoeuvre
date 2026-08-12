/**
 * One-off blast: sends the "welcome to your faction" email to every student
 * who already has a faction assigned. Manual trigger only — run with:
 *
 *   npx tsx --conditions=react-server scripts/send-faction-welcome.ts
 *
 * The --conditions=react-server flag is required: lib/notify.ts imports the
 * "server-only" marker package, which throws outside Next's server bundler
 * unless this resolve condition is set (Next sets it automatically; a plain
 * tsx/node run doesn't). Without the flag this script crashes immediately.
 *
 * Safe to re-run: skipped students are the ones with no faction_id, and the
 * notifications table logs every attempt for a paper trail either way. This
 * is a one-time blast, not idempotent against double-sends — don't run it twice
 * once it's succeeded.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createAdminClient } from "../lib/supabase/admin";
import { notifyFactionWelcome } from "../lib/notify";
import { factions as staticFactions } from "../lib/data";

const accentBySlug = new Map(staticFactions.map((f) => [f.slug, f.accent]));

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const supabase = createAdminClient();

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, name, faction_id")
    .not("faction_id", "is", null);
  if (studentsError || !students) throw new Error(`Failed to load students: ${studentsError?.message}`);

  const { data: factions, error: factionsError } = await supabase.from("factions").select("id, slug, name, lore");
  if (factionsError || !factions) throw new Error(`Failed to load factions: ${factionsError?.message}`);
  const factionById = new Map(factions.map((f) => [f.id, f]));

  console.log(`Sending faction welcome emails to ${students.length} students...`);

  let sent = 0;
  let skipped = 0;

  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch = students.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (student) => {
        const faction = factionById.get(student.faction_id as string);
        if (!faction) {
          console.warn(`  skip ${student.name}: no matching faction row for faction_id ${student.faction_id}`);
          skipped++;
          return;
        }
        const accent = accentBySlug.get(faction.slug) ?? "#22d3ee";
        await notifyFactionWelcome(student.id, student.name, faction.name, faction.lore, faction.slug, accent);
        sent++;
      })
    );
    console.log(`  ${Math.min(i + BATCH_SIZE, students.length)}/${students.length} processed`);
    if (i + BATCH_SIZE < students.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`Done. Attempted: ${sent}, skipped (no faction row): ${skipped}.`);
  console.log("Check the notifications table for per-student sent/failed status.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
