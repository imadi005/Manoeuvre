import ExcelJS from "exceljs";

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  const queries = process.argv.slice(3).map(q => q.toLowerCase());
  for (const ws of wb.worksheets) {
    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const name = String(row.getCell(3).value ?? "").trim();
      const register = String(row.getCell(4).value ?? "").trim();
      if (!name) continue;
      const nameLower = name.toLowerCase();
      for (const q of queries) {
        if (nameLower.includes(q)) {
          console.log(`[${ws.name}] ${name} -> ${register}  (matched query: "${q}")`);
        }
      }
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
