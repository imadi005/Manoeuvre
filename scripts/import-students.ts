import { config } from "dotenv";
config({ path: ".env.local" });

import { randomInt } from "node:crypto";
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { factions } from "../lib/data";

const DEFAULT_PASSWORD = "Manoeuvre@26";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fisher-Yates using crypto.randomInt for unbiased shuffling.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npm run import-students -- \"<path to xlsx>\"");
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  const rows: { rollNumber: string; name: string }[] = [];
  for (let i = 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const roll = String(row.getCell(1).value ?? "").trim().toUpperCase();
    const name = String(row.getCell(2).value ?? "").trim();
    if (!roll || !name || roll === "ROLLNO") continue;
    rows.push({ rollNumber: roll, name });
  }

  console.log(`Parsed ${rows.length} students from sheet.`);

  const { data: dbFactions, error: factionErr } = await supabase
    .from("factions")
    .select("id, slug");
  if (factionErr) throw factionErr;

  const factionIds = factions.map((f) => dbFactions!.find((d) => d.slug === f.slug)!.id);
  if (factionIds.some((id) => !id)) {
    throw new Error("Not all factions found in DB — run migrations/seed first.");
  }

  const shuffled = shuffle(rows);
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const records = shuffled.map((s, i) => ({
    roll_number: s.rollNumber,
    name: s.name,
    faction_id: factionIds[i % factionIds.length],
    password_hash: passwordHash,
    must_reset_password: true,
  }));

  console.log("Inserting students in batches...");
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from("students").upsert(batch, { onConflict: "roll_number" });
    if (error) throw error;
    console.log(`  ${Math.min(i + batchSize, records.length)}/${records.length}`);
  }

  console.log("\nFaction distribution:");
  for (const f of factions) {
    const factionId = dbFactions!.find((d) => d.slug === f.slug)!.id;
    const count = records.filter((r) => r.faction_id === factionId).length;
    console.log(" ", f.name.padEnd(14), count);
  }

  console.log(`\nDone. All students share the default password: ${DEFAULT_PASSWORD}`);
  console.log("Roll number login is case-insensitive. Students should be told to change this password after first login.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
