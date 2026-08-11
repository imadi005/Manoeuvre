import ExcelJS from "exceljs";

const MASTER_PATH = process.argv[2];
const ROLES_PATH = process.argv[3];

interface MasterEntry {
  name: string;
  register: string;
  email: string;
  course: string;
}

function normalize(s: string): string {
  return s.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .toLowerCase()
    .replace(/[.]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const CLASS_TO_SHEET: Record<string, string> = {
  "MCA A": "MCAA",
  "MCA B": "MCAB",
  "MCA C": "MCAC",
  "MCA D": "MCAD",
  "MSCS": "MSCS",
  "MDTS": "MDTS",
};

async function loadMaster(): Promise<Record<string, MasterEntry[]>> {
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
  return bySheet;
}

interface MatchResult {
  queryName: string;
  className: string;
  status: "matched" | "ambiguous" | "unmatched";
  candidates: MasterEntry[];
}

function findMatches(queryName: string, className: string, master: Record<string, MasterEntry[]>): MatchResult {
  const sheetKey = CLASS_TO_SHEET[normalize(className).replace(/\s+/g, " ")];
  const pool = sheetKey ? master[sheetKey] ?? [] : [];
  const qTokens = tokens(queryName);

  const scored = pool
    .map((entry) => {
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
      return { entry, score, allTokensHit };
    })
    .filter((s) => s.allTokensHit)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { queryName, className, status: "unmatched", candidates: [] };
  }
  const topScore = scored[0].score;
  const top = scored.filter((s) => s.score === topScore);
  if (top.length === 1) {
    return { queryName, className, status: "matched", candidates: [top[0].entry] };
  }
  return { queryName, className, status: "ambiguous", candidates: top.map((s) => s.entry) };
}

function scoreEntry(qTokens: string[], entry: MasterEntry): { score: number; allTokensHit: boolean } {
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

function findMatchesInPool(queryName: string, pool: MasterEntry[]): { status: "matched" | "ambiguous" | "unmatched"; candidates: MasterEntry[] } {
  const qTokens = tokens(queryName);
  const scored = pool
    .map((entry) => ({ entry, ...scoreEntry(qTokens, entry) }))
    .filter((s) => s.allTokensHit)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { status: "unmatched", candidates: [] };
  const topScore = scored[0].score;
  const top = scored.filter((s) => s.score === topScore);
  if (top.length === 1) return { status: "matched", candidates: [top[0].entry] };
  return { status: "ambiguous", candidates: top.map((s) => s.entry) };
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function fuzzyFindInPool(queryName: string, pool: MasterEntry[], maxDist: number): MasterEntry[] {
  const qFirst = tokens(queryName)[0] ?? "";
  return pool.filter((entry) => {
    const nFirst = tokens(entry.name)[0] ?? "";
    return levenshtein(qFirst, nFirst) <= maxDist;
  });
}

async function loadStudentList(): Promise<{ name: string; className: string; register: string }[]> {
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

async function main() {
  const master = await loadMaster();
  const students = await loadStudentList();

  const allEntries = Object.values(master).flat();

  const matched: { name: string; className: string; register: string; email: string; note?: string }[] = [];
  const ambiguous: MatchResult[] = [];
  const unmatched: MatchResult[] = [];
  const fuzzy: { queryName: string; className: string; candidates: MasterEntry[] }[] = [];

  for (const s of students) {
    if (s.register) {
      matched.push({ name: s.name, className: s.className, register: s.register, email: "" });
      continue;
    }
    const result = findMatches(s.name, s.className, master);
    if (result.status === "matched") {
      const c = result.candidates[0];
      matched.push({ name: s.name, className: s.className, register: c.register, email: c.email });
      continue;
    }
    if (result.status === "ambiguous") {
      ambiguous.push(result);
      continue;
    }

    // Fall back to searching every sheet, in case the class label is wrong
    const global = findMatchesInPool(s.name, allEntries);
    if (global.status === "matched") {
      const c = global.candidates[0];
      matched.push({
        name: s.name,
        className: s.className,
        register: c.register,
        email: c.email,
        note: `class mismatch — actually ${c.course}`,
      });
      continue;
    }
    if (global.status === "ambiguous") {
      ambiguous.push({ queryName: s.name, className: s.className, status: "ambiguous", candidates: global.candidates });
      continue;
    }

    // Last resort: fuzzy first-name match across all sheets
    const fuzzyMatches = fuzzyFindInPool(s.name, allEntries, 2);
    if (fuzzyMatches.length > 0) {
      fuzzy.push({ queryName: s.name, className: s.className, candidates: fuzzyMatches });
    } else {
      unmatched.push({ queryName: s.name, className: s.className, status: "unmatched", candidates: [] });
    }
  }

  console.log(`\nTotal in Student List: ${students.length}`);
  console.log(`Matched: ${matched.length}`);
  console.log(`Ambiguous: ${ambiguous.length}`);
  console.log(`Unmatched: ${unmatched.length}`);

  console.log("\n=== MATCHED ===");
  for (const m of matched) {
    console.log(`  ${m.name.padEnd(28)} ${m.className.padEnd(8)} -> ${m.register}${m.note ? "  [" + m.note + "]" : ""}`);
  }

  if (ambiguous.length) {
    console.log("\n=== AMBIGUOUS (needs manual pick) ===");
    for (const a of ambiguous) {
      console.log(`  "${a.queryName}" (${a.className}):`);
      a.candidates.forEach((c) => console.log(`      - ${c.name} -> ${c.register}`));
    }
  }

  if (fuzzy.length) {
    console.log("\n=== FUZZY (spelling-variant guesses, needs confirmation) ===");
    for (const f of fuzzy) {
      console.log(`  "${f.queryName}" (${f.className}):`);
      f.candidates.forEach((c) => console.log(`      - ${c.name} -> ${c.register} (${c.course})`));
    }
  }

  if (unmatched.length) {
    console.log("\n=== UNMATCHED (no candidate found anywhere) ===");
    for (const u of unmatched) {
      console.log(`  "${u.queryName}" (${u.className})`);
    }
  }

  console.log(`\nFinal tally — matched: ${matched.length}, ambiguous: ${ambiguous.length}, fuzzy: ${fuzzy.length}, unmatched: ${unmatched.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
