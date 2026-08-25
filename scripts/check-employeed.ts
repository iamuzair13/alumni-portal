import XLSX from "xlsx";
import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  // 1. Check exact "occupation status" values in Excel
  const excelPath = "C:\\Users\\chuza\\Downloads\\Alumni 2026 REVISED SHEET.xlsx";
  const workbook = XLSX.readFile(excelPath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: null }) as any[];

  const excelValues = new Map<string, number>();
  for (const row of data) {
    const v = row["occupation status"];
    const key = v === null || v === undefined ? "(empty)" : String(v).trim();
    excelValues.set(key, (excelValues.get(key) || 0) + 1);
  }
  console.log("=== Excel 'occupation status' exact values ===");
  for (const [k, c] of excelValues) {
    console.log(`  [${c}] "${k}"`);
  }

  // 2. Check current 'employeed' values in DB for the imported records
  const dbValues = await sql`
    SELECT employeed, COUNT(*) as cnt
    FROM public.tbl_alumni
    WHERE datasource = 'Excel Import 2026'
    GROUP BY employeed
    ORDER BY cnt DESC
  `;
  console.log("\n=== DB 'employeed' values for 'Excel Import 2026' records ===");
  for (const r of dbValues) {
    console.log(`  [${r.cnt}] "${r.employeed}"`);
  }

  await sql.end();
})();
