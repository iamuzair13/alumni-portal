/**
 * Export the university org structure (Faculty -> Department -> Program)
 * from mock-programs.json (the DB extract used by src/data/programs-departments.ts)
 * into an Excel workbook.
 *
 * Sheets:
 *   1. Hierarchy - flat parent/child table, one row per program
 *      (Faculty | Faculty # | Department | Program | program index)
 *   2. Tree      - indented hierarchy view for readability
 *   3. Summary   - counts per faculty + totals
 *
 * Run: npx tsx scripts/export-org-structure.ts [outfile]
 * Default output: organization-structure.xlsx in repo root.
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

type Dept = { department: string; programs: string[] };
type Fac = { faculty: string; departments: Dept[] };

const ROOT = process.cwd();
const SRC = path.join(ROOT, "mock-programs.json");
const OUT = path.resolve(ROOT, process.argv[2] ?? "organization-structure.xlsx");

const data = JSON.parse(fs.readFileSync(SRC, "utf8")) as Fac[];
if (!Array.isArray(data) || data.length === 0) {
  console.error("mock-programs.json: expected a non-empty faculty array");
  process.exit(1);
}

// ─── Sheet 1: flat hierarchy ────────────────────────────────────────────────
const rows: Array<Record<string, string | number>> = [];
let deptTotal = 0;
let progTotal = 0;

for (const fac of data) {
  for (const dept of fac.departments) {
    deptTotal++;
    for (const prog of dept.programs) {
      progTotal++;
      rows.push({
        Faculty: fac.faculty,
        Department: dept.department,
        Program: prog,
      });
    }
    if (dept.programs.length === 0) {
      rows.push({ Faculty: fac.faculty, Department: dept.department, Program: "(no programs)" });
    }
  }
  if (fac.departments.length === 0) {
    rows.push({ Faculty: fac.faculty, Department: "(no departments)", Program: "" });
  }
}

// ─── Sheet 2: indented tree ─────────────────────────────────────────────────
const tree: Array<{ Level: string; Name: string; Path: string }> = [];
for (const fac of data) {
  tree.push({ Level: "Faculty", Name: fac.faculty, Path: fac.faculty });
  for (const dept of fac.departments) {
    tree.push({ Level: "  Department", Name: dept.department, Path: `${fac.faculty} / ${dept.department}` });
    for (const prog of dept.programs) {
      tree.push({ Level: "    Program", Name: prog, Path: `${fac.faculty} / ${dept.department} / ${prog}` });
    }
  }
}

// ─── Sheet 3: summary ───────────────────────────────────────────────────────
const summary = [
  ...data.map((fac) => ({
    Faculty: fac.faculty,
    Departments: fac.departments.length,
    Programs: fac.departments.reduce((n, d) => n + d.programs.length, 0),
  })),
  { Faculty: "TOTAL", Departments: deptTotal, Programs: progTotal },
];

const wb = XLSX.utils.book_new();
const s1 = XLSX.utils.json_to_sheet(rows);
s1["!cols"] = [{ wch: 42 }, { wch: 46 }, { wch: 58 }];
XLSX.utils.book_append_sheet(wb, s1, "Hierarchy");

const s2 = XLSX.utils.json_to_sheet(tree);
s2["!cols"] = [{ wch: 14 }, { wch: 58 }, { wch: 120 }];
XLSX.utils.book_append_sheet(wb, s2, "Tree");

const s3 = XLSX.utils.json_to_sheet(summary);
s3["!cols"] = [{ wch: 42 }, { wch: 12 }, { wch: 10 }];
XLSX.utils.book_append_sheet(wb, s3, "Summary");

XLSX.writeFile(wb, OUT);
console.log(`Wrote ${OUT}`);
console.log(`Faculties: ${data.length} | Departments: ${deptTotal} | Programs: ${progTotal}`);
