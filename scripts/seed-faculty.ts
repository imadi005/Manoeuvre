import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Faculty in charge, per event — from the college's own event/faculty sheet.
const FACULTY: { eventSlug: string; names: string[] }[] = [
  { eventSlug: "cortex-vortex", names: ["Neetha"] },
  { eventSlug: "blacktie-protocol", names: ["Angeline"] },
  { eventSlug: "room-zero", names: ["Mythili"] },
  { eventSlug: "blackout-build", names: ["Ebanesar"] },
  { eventSlug: "static-vision", names: ["Subramaniakumar"] },
  { eventSlug: "cyberpitch", names: ["Sheeja"] },
  { eventSlug: "ghost-override", names: ["Vinothina"] },
  { eventSlug: "the-grid", names: ["Karthik", "Satheesh"] },
  { eventSlug: "sleeper-cell", names: ["Gokila", "Ramya"] },
  { eventSlug: "the-trace", names: ["Kohila", "Vimala Roseline"] },
];

function randomPassword() {
  return Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
}

async function main() {
  const records: {
    name: string;
    role: string;
    detail: string;
    is_faculty: boolean;
    username: string;
    password_hash: string;
    must_reset_password: boolean;
  }[] = [];
  const credentials: { username: string; password: string; name: string; event: string }[] = [];

  for (const { eventSlug, names } of FACULTY) {
    for (const name of names) {
      const slugName = name.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/)[0];
      const username = `faculty.${eventSlug}.${slugName}`;
      const password = randomPassword();
      const password_hash = await bcrypt.hash(password, 12);

      records.push({
        name,
        role: "faculty",
        detail: eventSlug,
        is_faculty: true,
        username,
        password_hash,
        must_reset_password: true,
      });
      credentials.push({ username, password, name, event: eventSlug });
    }
  }

  const { error } = await supabase.from("organizers").insert(records);
  if (error) throw error;

  console.log(`Inserted ${records.length} faculty accounts.\n`);
  console.log("=== Faculty login credentials (save these — shown once) ===");
  console.log("username".padEnd(35), "password".padEnd(10), "name (event)");
  console.log("-".repeat(80));
  for (const c of credentials) {
    console.log(c.username.padEnd(35), c.password.padEnd(10), `${c.name} (${c.event})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
