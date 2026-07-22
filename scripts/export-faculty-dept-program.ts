import postgres from "postgres";
import dotenv from "dotenv";
import * as XLSX from "xlsx";
import * as path from "path";

dotenv.config({ path: '.env.local' });
dotenv.config();

const databaseUrl = process.argv[2] || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ Error: DATABASE_URL is not set");
  console.error("");
  console.error("Usage options:");
  console.error('  1. Pass DATABASE_URL as argument:');
  console.error('     npx tsx scripts/export-faculty-dept-program.ts "postgresql://user:password@host:port/database"');
  console.error("");
  console.error("  2. Set environment variable:");
  console.error('     $env:DATABASE_URL="postgresql://user:password@host:port/database"; npx tsx scripts/export-faculty-dept-program.ts');
  console.error("");
  console.error("  3. Create .env.local file with:");
  console.error('     DATABASE_URL="postgresql://user:password@host:port/database"');
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

type Row = {
  faculty_id: number;
  faculty_name: string;
  department_id: number | null;
  department_name: string | null;
  department_code: string | null;
  program_id: number | null;
  program_name: string | null;
  program_abv: string | null;
};

async function main() {
  try {
    console.log("Fetching faculties, departments, and programs...");

    const rows = await sql`
      SELECT
        f.id        AS faculty_id,
        f.faculty_name,
        d.id        AS department_id,
        d.department_name,
        d.department_code,
        p.id        AS program_id,
        p.program_name,
        p.program_abv
      FROM public.tbl_faculties f
      LEFT JOIN public.tbl_departments d ON d.faculty_id = f.id
      LEFT JOIN public.tbl_programs p    ON p.department_id = d.id
      ORDER BY
        f.faculty_name ASC,
        d.department_name ASC NULLS LAST,
        p.program_name ASC NULLS LAST
    `;

    const data = rows as unknown as Row[];

    console.log(`\n✅ Found ${data.length} rows`);

    // Build flat rows for Excel
    const excelRows: Record<string, string | number>[] = data.map((r) => ({
      "Faculty ID": r.faculty_id,
      "Faculty Name": r.faculty_name ?? "",
      "Department ID": r.department_id ?? "",
      "Department Name": r.department_name ?? "",
      "Department Code": r.department_code ?? "",
      "Program ID": r.program_id ?? "",
      "Program Name": r.program_name ?? "",
      "Program Abbreviation": r.program_abv ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);

    ws["!cols"] = [
      { wch: 10 },
      { wch: 40 },
      { wch: 12 },
      { wch: 40 },
      { wch: 15 },
      { wch: 10 },
      { wch: 50 },
      { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faculty-Dept-Program");

    const outputPath = path.join(process.cwd(), "faculty-department-program.xlsx");
    XLSX.writeFile(wb, outputPath);

    console.log(`\n✅ Excel file saved to: ${outputPath}`);

    const facultyCount = new Set(data.map((r) => r.faculty_id)).size;
    const deptCount = new Set(data.filter((r) => r.department_id != null).map((r) => r.department_id)).size;
    const progCount = new Set(data.filter((r) => r.program_id != null).map((r) => r.program_id)).size;

    console.log(`   Faculties:   ${facultyCount}`);
    console.log(`   Departments: ${deptCount}`);
    console.log(`   Programs:    ${progCount}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
