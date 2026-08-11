import ExcelJS from "exceljs";

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  const ws = wb.getWorksheet(process.argv[3]);
  if (!ws) { console.log("sheet not found", wb.worksheets.map(w=>w.name)); return; }
  console.log(`rows=${ws.rowCount} cols=${ws.columnCount}`);
  for (let i = 1; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const values = (row.values as unknown[]).slice(1);
    const hasContent = values.some(v => v !== null && v !== undefined && String(v).trim() !== "");
    if (hasContent) console.log(i, JSON.stringify(values));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
