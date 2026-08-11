import { config } from "dotenv";
config({ path: ".env.local" });

import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { events } from "../lib/data";

const MASTER_PATH = process.argv[2];
const ROLES_PATH = process.argv[3];

if (!MASTER_PATH || !ROLES_PATH) {
  console.error('Usage: npm run seed-organizers -- "<master data xlsx>" "<roles xlsx>"');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MasterEntry {
  name: string;
  register: string;
  email: string;
  course: string;
}

function normalize(s: string): string {
  return s.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

function stripAnnotation(s: string): string {
  return normalize(s).replace(/\([^)]*\)/g, "").trim();
}

function tokens(s: string): string[] {
  return normalize(s).toLowerCase().replace(/[.]/g, " ").split(/\s+/).filter(Boolean);
}

const CLASS_TO_SHEET: Record<string, string> = {
  "MCA A": "MCAA",
  "MCA B": "MCAB",
  "MCA C": "MCAC",
  "MCA D": "MCAD",
  MSCS: "MSCS",
  MDTS: "MDTS",
};

async function loadMaster(): Promise<{ bySheet: Record<string, MasterEntry[]>; all: MasterEntry[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(MASTER_PATH);
  const bySheet: Record<string, MasterEntry[]> = {};
  for (const ws of wb.worksheets) {
    const entries: MasterEntry[] = [];
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const email = String(row.getCell(2).value ?? "").trim();
      const name = String(row.getCell(3).value ?? "").trim();
      const register = String(row.getCell(4).value ?? "").trim();
      const course = String(row.getCell(5).value ?? "").trim();
      if (name && register) entries.push({ name, register, email, course });
    }
    bySheet[ws.name] = entries;
  }
  return { bySheet, all: Object.values(bySheet).flat() };
}

function scoreEntry(qTokens: string[], entry: MasterEntry) {
  const nTokens = tokens(entry.name);
  let allTokensHit = true;
  let score = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const nt of nTokens) {
      if (nt === qt) best = Math.max(best, 2);
      else if (qt.length >= 3 && nt.startsWith(qt)) best = Math.max(best, 1);
      else if (nt.length >= 3 && qt.startsWith(nt)) best = Math.max(best, 1);
    }
    if (best === 0) allTokensHit = false;
    score += best;
  }
  return { score, allTokensHit };
}

function findInPool(queryName: string, pool: MasterEntry[]) {
  const qTokens = tokens(queryName);
  const scored = pool
    .map((entry) => ({ entry, ...scoreEntry(qTokens, entry) }))
    .filter((s) => s.allTokensHit)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { status: "unmatched" as const, candidates: [] as MasterEntry[] };
  const top = scored.filter((s) => s.score === scored[0].score);
  if (top.length === 1) return { status: "matched" as const, candidates: [top[0].entry] };
  return { status: "ambiguous" as const, candidates: top.map((s) => s.entry) };
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function fuzzyFind(queryName: string, pool: MasterEntry[], maxDist: number): MasterEntry[] {
  const qFirst = tokens(queryName)[0] ?? "";
  return pool.filter((entry) => levenshtein(qFirst, tokens(entry.name)[0] ?? "") <= maxDist);
}

async function loadStudentList() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ROLES_PATH);
  const ws = wb.getWorksheet("Student List")!;
  const rows: { name: string; className: string; register: string }[] = [];
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const className = normalize(String(row.getCell(4).value ?? ""));
    const name = normalize(String(row.getCell(5).value ?? ""));
    const register = normalize(String(row.getCell(6).value ?? ""));
    if (name) rows.push({ name, className, register });
  }
  return rows;
}

type Resolved = { register: string; email: string; course: string } | "faculty";

// Names that appear in Sheet1's role columns but not in the Student List
// directory tab — resolved by hand via cross-sheet + fuzzy search, confirmed
// with the user for the three genuine spelling variants (Geoffrey/Jagmeet/Thrisha
// already come through the Student List fuzzy tier; these are the extra ones).
const MANUAL_OVERRIDES: Record<string, string | null> = {
  shivananda: "25MCAA45",
  aashish: "25MCAB10",
  "raihana zainab": "25MCAA38",
  thejas: "25MCAB45",
  "allen joseph jolly": "25MCAB05",
  "sai teja shree": "25MDTS55",
  "mani rajan": "25MCAB19",
  ayshwarya: "25MCAD02",
  // Confirmed faculty/staff — no student register number exists.
  gayathri: null,
  arulmozhiarasu: null,
  jibin: null,
  abinaya: null,
  thomas: null, // ambiguous among 3 students with that surname; treated as unresolved
  neetha: null,
  princess: null,
  sangeetha: null,
};

async function main() {
  const { bySheet, all } = await loadMaster();
  const studentListRows = await loadStudentList();

  // Build the resolved lookup keyed by normalized query name.
  const lookup = new Map<string, Resolved>();

  for (const row of studentListRows) {
    const key = tokens(row.name).join(" ");
    if (row.register) {
      const entry = all.find((e) => e.register.toUpperCase() === row.register.toUpperCase());
      lookup.set(key, entry ? { register: entry.register, email: entry.email, course: entry.course } : "faculty");
      continue;
    }
    const sheetKey = CLASS_TO_SHEET[row.className];
    const pool = sheetKey ? bySheet[sheetKey] ?? [] : [];
    let result = findInPool(row.name, pool);
    if (result.status !== "matched") result = findInPool(row.name, all);
    if (result.status === "matched") {
      const c = result.candidates[0];
      lookup.set(key, { register: c.register, email: c.email, course: c.course });
    } else {
      const fz = fuzzyFind(row.name, all, 2);
      lookup.set(key, fz.length === 1 ? { register: fz[0].register, email: fz[0].email, course: fz[0].course } : "faculty");
    }
  }

  for (const [name, register] of Object.entries(MANUAL_OVERRIDES)) {
    if (register === null) {
      lookup.set(name, "faculty");
    } else {
      const entry = all.find((e) => e.register === register);
      if (entry) lookup.set(name, { register: entry.register, email: entry.email, course: entry.course });
    }
  }

  function resolve(rawName: string): { name: string; resolved: Resolved } {
    const clean = stripAnnotation(rawName);
    const key = tokens(clean).join(" ");
    if (lookup.has(key)) return { name: clean, resolved: lookup.get(key)! };
    const firstToken = tokens(clean)[0] ?? "";
    if (lookup.has(firstToken)) return { name: clean, resolved: lookup.get(firstToken)! };
    console.warn(`  ! No resolution found for "${clean}" — storing as faculty/unknown`);
    return { name: clean, resolved: "faculty" };
  }

  function splitNames(cell: string): string[] {
    return cell
      .split("\n")
      .map((s) => normalize(s))
      .filter(Boolean);
  }

  // ---- Parse Sheet1 ----
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ROLES_PATH);
  const ws = wb.getWorksheet("Sheet1")!;

  type OrganizerRow = {
    name: string;
    roll_number: string | null;
    role: "main_coordinator" | "event_lead" | "control_room" | "documentation" | "committee";
    detail: string | null;
    is_faculty: boolean;
  };

  const rows: OrganizerRow[] = [];

  function addPerson(rawName: string, role: OrganizerRow["role"], detail: string | null) {
    const { name, resolved } = resolve(rawName);
    if (resolved === "faculty") {
      rows.push({ name, roll_number: null, role, detail, is_faculty: true });
    } else {
      rows.push({ name, roll_number: resolved.register, role, detail, is_faculty: false });
    }
  }

  // Central coordinators (rows 3-7, col B label / col C name)
  for (let i = 3; i <= 7; i++) {
    const row = ws.getRow(i);
    const name = normalize(String(row.getCell(3).value ?? ""));
    if (name) addPerson(name, "main_coordinator", null);
  }

  // Event heads (rows 9-18): col B event name, col C student leads (\n separated)
  for (let i = 9; i <= 18; i++) {
    const row = ws.getRow(i);
    const eventName = normalize(String(row.getCell(2).value ?? ""));
    const leadsCell = String(row.getCell(3).value ?? "");
    if (!eventName || !leadsCell.trim()) continue;
    const event = events.find((e) => e.name.toLowerCase() === eventName.toLowerCase());
    const slug = event?.slug ?? null;
    if (!slug) console.warn(`  ! Event name "${eventName}" didn't match any known event slug`);
    for (const leadName of splitNames(leadsCell)) {
      addPerson(leadName, "event_lead", slug);
    }
  }

  // Committees (rows 3-9): col E name, col F members, col G head
  for (let i = 3; i <= 9; i++) {
    const row = ws.getRow(i);
    const committeeName = normalize(String(row.getCell(5).value ?? ""));
    const membersCell = String(row.getCell(6).value ?? "");
    const headCell = String(row.getCell(7).value ?? "");
    if (!committeeName) continue;

    const role: OrganizerRow["role"] =
      committeeName === "Control Room" ? "control_room" : committeeName === "Documentation" ? "documentation" : "committee";

    for (const memberName of splitNames(membersCell)) {
      addPerson(memberName, role, committeeName);
    }
    for (const headName of splitNames(headCell)) {
      addPerson(headName, role, `${committeeName} (Head)`);
    }
  }

  console.log(`\nParsed ${rows.length} organizer role entries.`);
  console.log(`  Students (with roll number): ${rows.filter((r) => !r.is_faculty).length}`);
  console.log(`  Faculty/unresolved: ${rows.filter((r) => r.is_faculty).length}`);

  // ---- Faction heads roll-number backfill ----
  const { data: dbFactionHeads } = await supabase.from("faction_heads").select("id, name");
  const factionHeadUpdates: { id: string; name: string; roll_number: string }[] = [];
  for (const fh of dbFactionHeads ?? []) {
    const { resolved } = resolve(fh.name);
    if (resolved !== "faculty") {
      factionHeadUpdates.push({ id: fh.id, name: fh.name, roll_number: resolved.register });
    } else {
      console.warn(`  ! Could not resolve roll number for faction head "${fh.name}"`);
    }
  }

  // ---- Write to DB ----
  console.log("\nUpdating faction_heads with roll numbers...");
  for (const u of factionHeadUpdates) {
    const { error } = await supabase.from("faction_heads").update({ roll_number: u.roll_number }).eq("id", u.id);
    if (error) throw error;
  }
  console.log(`  Updated ${factionHeadUpdates.length} faction heads.`);

  console.log("\nSeeding organizers table...");
  const loginRoles: OrganizerRow["role"][] = ["main_coordinator", "event_lead", "control_room", "documentation"];
  const credentials: { username: string; password: string; name: string; role: string }[] = [];

  const records = [];
  for (const r of rows) {
    let username: string | null = null;
    let password_hash: string | null = null;

    if (!r.is_faculty && loginRoles.includes(r.role)) {
      const slugName = r.name.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/)[0];
      const password = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
      username = `${r.role}.${slugName}.${r.roll_number!.toLowerCase()}`;
      password_hash = await bcrypt.hash(password, 12);
      credentials.push({ username, password, name: r.name, role: r.detail ? `${r.role} (${r.detail})` : r.role });
    }

    records.push({
      name: r.name,
      roll_number: r.roll_number,
      role: r.role,
      detail: r.detail,
      is_faculty: r.is_faculty,
      username,
      password_hash,
      must_reset_password: true,
    });
  }

  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from("organizers").insert(batch);
    if (error) throw error;
  }
  console.log(`  Inserted ${records.length} organizer rows.`);

  console.log("\n=== Login credentials (save these — shown once) ===");
  console.log("username".padEnd(45), "password".padEnd(10), "name / role");
  console.log("-".repeat(90));
  for (const c of credentials) {
    console.log(c.username.padEnd(45), c.password.padEnd(10), `${c.name} — ${c.role}`);
  }

  console.log(`\nDone. ${credentials.length} people got login credentials (main coordinators, event leads, control room, documentation).`);
  console.log("Everyone else (committee members/heads, faculty) was stored as directory-only data for certificates — no login.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
