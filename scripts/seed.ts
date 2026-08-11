import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { factions } from "../lib/data";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function randomPassword() {
  return Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
}

async function main() {
  console.log("Seeding factions...");
  for (const f of factions) {
    const { error } = await supabase
      .from("factions")
      .upsert({ slug: f.slug, name: f.name }, { onConflict: "slug" });
    if (error) throw error;
  }

  const { data: dbFactions, error: factionErr } = await supabase.from("factions").select("id, slug");
  if (factionErr) throw factionErr;
  const factionIdBySlug = new Map(dbFactions!.map((f) => [f.slug, f.id]));

  console.log("\nSeeding faction heads...\n");
  console.log("username".padEnd(28), "password");
  console.log("-".repeat(45));

  for (const f of factions) {
    const factionId = factionIdBySlug.get(f.slug);
    for (const headName of f.heads) {
      const username = `${f.slug}.${headName.toLowerCase().split(" ")[0]}`;
      const password = randomPassword();
      const password_hash = await bcrypt.hash(password, 12);

      const { error } = await supabase
        .from("faction_heads")
        .upsert(
          { username, name: headName, faction_id: factionId, password_hash, must_reset_password: true },
          { onConflict: "username" }
        );
      if (error) throw error;

      console.log(username.padEnd(28), password);
    }
  }

  console.log("\nSeeding a test student (24MCA001, faction: Neo Ronin)...\n");
  const testPassword = randomPassword();
  const testHash = await bcrypt.hash(testPassword, 12);
  const { error: studentErr } = await supabase.from("students").upsert(
    {
      roll_number: "24MCA001",
      name: "Test Student",
      faction_id: factionIdBySlug.get("neo-ronin"),
      password_hash: testHash,
      must_reset_password: true,
    },
    { onConflict: "roll_number" }
  );
  if (studentErr) throw studentErr;
  console.log("roll_number".padEnd(28), "password");
  console.log("-".repeat(45));
  console.log("24MCA001".padEnd(28), testPassword);

  console.log("\nDone. Save these credentials — passwords are not stored anywhere else.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
