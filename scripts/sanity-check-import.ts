import XLSX from "xlsx";
import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const sql = postgres(process.env.DATABASE_URL!, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 30,
  prepare: false,
});

function clean(value: any): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

function cleanEmail(value: any): string | null {
  const email = clean(value);
  if (!email) return null;
  return email.toLowerCase();
}

function cleanNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

async function main() {
  const excelPath = "C:\\Users\\chuza\\Downloads\\Alumni 2026 REVISED SHEET.xlsx";
  console.log(`Reading Excel: ${excelPath}\n`);

  const workbook = XLSX.readFile(excelPath, { cellDates: true, dateNF: "yyyy-mm-dd" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null }) as any[];

  console.log(`Sheet: "${sheetName}" — ${data.length} rows\n`);

  // Show columns
  const firstRow = data[0] as any;
  const columns = Object.keys(firstRow);
  console.log("Columns in Excel:");
  columns.forEach((c) => console.log(`  - "${c}"`));
  console.log(`\nTotal columns: ${columns.length}\n`);

  // Show first 3 rows
  console.log("=== First 3 rows (full preview) ===\n");
  for (let i = 0; i < Math.min(3, data.length); i++) {
    const row = data[i] as any;
    console.log(`--- Row ${i + 2} ---`);
    for (const col of columns) {
      const val = row[col];
      console.log(`  ${col}: ${val === null || val === undefined ? "(empty)" : val}`);
    }
    console.log();
  }

  // Check "faculty id" and "department id" columns — are they null or populated?
  console.log("=== Checking 'faculty id' and 'department id' columns ===\n");
  let facultyIdNull = 0;
  let facultyIdPopulated = 0;
  let deptIdNull = 0;
  let deptIdPopulated = 0;
  const facultyIdValues = new Set<string>();
  const deptIdValues = new Set<string>();

  for (const row of data) {
    const fid = clean(row["faculty id"]);
    const did = clean(row["department id"]);

    if (fid) { facultyIdPopulated++; facultyIdValues.add(fid); }
    else facultyIdNull++;

    if (did) { deptIdPopulated++; deptIdValues.add(did); }
    else deptIdNull++;
  }

  console.log(`  "faculty id" column: ${facultyIdPopulated} populated, ${facultyIdNull} null/empty`);
  if (facultyIdValues.size > 0 && facultyIdValues.size <= 30) {
    console.log(`  Unique "faculty id" values:`);
    for (const v of facultyIdValues) console.log(`    - "${v}"`);
  }

  console.log(`  "department id" column: ${deptIdPopulated} populated, ${deptIdNull} null/empty`);
  if (deptIdValues.size > 0 && deptIdValues.size <= 50) {
    console.log(`  Unique "department id" values:`);
    for (const v of deptIdValues) console.log(`    - "${v}"`);
  }

  // Extract unique text values for faculty ("Char"), department ("department"), and degree
  const facultyTexts = new Set<string>();
  const departmentTexts = new Set<string>();
  const degreeTexts = new Set<string>();
  const campusTexts = new Set<string>();

  for (const row of data) {
    const faculty = clean(row["Char"]); // "Char" column = faculty name
    const dept = clean(row["department"]);
    const degree = clean(row["Degree Name"]);
    const campus = clean(row["campus"]);

    if (faculty) facultyTexts.add(faculty);
    if (dept) departmentTexts.add(dept);
    if (degree) degreeTexts.add(degree);
    if (campus) campusTexts.add(campus);
  }

  console.log(`\n=== Unique Faculty texts ("Char" column) — ${facultyTexts.size} ===`);
  for (const f of facultyTexts) console.log(`  - "${f}"`);

  console.log(`\n=== Unique Department texts ("department" column) — ${departmentTexts.size} ===`);
  for (const d of departmentTexts) console.log(`  - "${d}"`);

  console.log(`\n=== Unique Degree texts ("Degree Name" column) — ${degreeTexts.size} ===`);
  for (const d of degreeTexts) console.log(`  - "${d}"`);

  console.log(`\n=== Unique Campus texts — ${campusTexts.size} ===`);
  for (const c of campusTexts) console.log(`  - "${c}"`);

  // Check required fields
  console.log("\n=== Required Field Check ===\n");
  let missingSapid = 0;
  let missingName = 0;
  let missingEmail = 0;
  let missingCnic = 0;
  let dupSapids = 0;
  const sapidSet = new Set<string>();
  const dupSapidList: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const sapid = clean(row["SAP ID"]);
    const name = clean(row["Name"]);
    const email = cleanEmail(row["Email"]);
    const cnic = clean(row["CNIC"]);

    if (!sapid) missingSapid++;
    else {
      if (sapidSet.has(sapid)) { dupSapids++; dupSapidList.push(sapid); }
      else sapidSet.add(sapid);
    }
    if (!name) missingName++;
    if (!email) missingEmail++;
    if (!cnic) missingCnic++;
  }

  console.log(`  Total rows: ${data.length}`);
  console.log(`  Missing SAP ID: ${missingSapid}`);
  console.log(`  Missing Name: ${missingName}`);
  console.log(`  Missing Email: ${missingEmail}`);
  console.log(`  Missing CNIC: ${missingCnic}`);
  console.log(`  Duplicate SAP IDs within Excel: ${dupSapids}`);
  if (dupSapidList.length > 0) {
    console.log(`  Duplicate SAP IDs: ${dupSapidList.slice(0, 10).join(", ")}${dupSapidList.length > 10 ? "..." : ""}`);
  }

  // Now connect to DB and do matching
  console.log("\n=== Connecting to Database ===\n");
  try {
    // Fetch faculties
    const faculties = await sql`
      SELECT id, faculty_name FROM public.tbl_faculties ORDER BY faculty_name
    ` as Array<{ id: bigint; faculty_name: string | null }>;
    console.log(`Faculties in DB (${faculties.length}):`);
    for (const f of faculties) console.log(`  [${f.id}] "${f.faculty_name}"`);

    // Fetch departments
    const departments = await sql`
      SELECT id, department_name, faculty_id FROM public.tbl_departments ORDER BY department_name
    ` as Array<{ id: bigint; department_name: string | null; faculty_id: bigint | null }>;
    console.log(`\nDepartments in DB (${departments.length}):`);
    for (const d of departments) console.log(`  [${d.id}] "${d.department_name}" (faculty_id: ${d.faculty_id})`);

    // Fetch programs
    const programs = await sql`
      SELECT id, program_name, department_id FROM public.tbl_programs ORDER BY program_name
    ` as Array<{ id: bigint; program_name: string | null; department_id: bigint | null }>;
    console.log(`\nPrograms in DB (${programs.length}):`);
    for (const p of programs) console.log(`  [${p.id}] "${p.program_name}" (department_id: ${p.department_id})`);

    // Build lookup maps (case-insensitive, trimmed)
    // Also normalize: replace "and" <-> "&", collapse whitespace, strip trailing truncation
    const normalize = (s: string): string =>
      s.toLowerCase().trim().replace(/\s+/g, " ").replace(/\band\b/g, "&");

    const facultyMap = new Map<string, bigint>();
    const facultyMapNormalized = new Map<string, bigint>();
    for (const f of faculties) {
      if (f.faculty_name) {
        facultyMap.set(f.faculty_name.toLowerCase().trim(), f.id);
        facultyMapNormalized.set(normalize(f.faculty_name), f.id);
      }
    }
    const departmentMap = new Map<string, bigint>();
    const departmentMapNormalized = new Map<string, bigint>();
    for (const d of departments) {
      if (d.department_name) {
        departmentMap.set(d.department_name.toLowerCase().trim(), d.id);
        departmentMapNormalized.set(normalize(d.department_name), d.id);
      }
    }
    const programMap = new Map<string, bigint>();
    for (const p of programs) {
      if (p.program_name) programMap.set(p.program_name.toLowerCase().trim(), p.id);
    }

    // Fuzzy match helper: try exact, then normalized, then prefix (for truncated Excel values)
    const fuzzyMatch = (
      text: string,
      exactMap: Map<string, bigint>,
      normalizedMap: Map<string, bigint>
    ): bigint | null => {
      const key = text.toLowerCase().trim();
      if (exactMap.has(key)) return exactMap.get(key)!;
      const normKey = normalize(text);
      if (normalizedMap.has(normKey)) return normalizedMap.get(normKey)!;
      // Prefix match: Excel value may be truncated (e.g. "Medicin" vs "Medicine")
      for (const [k, v] of normalizedMap) {
        if (k.startsWith(normKey) || normKey.startsWith(k)) return v;
      }
      return null;
    };

    // Match faculty texts
    console.log("\n=== Faculty Matching (Excel \"Char\" → tbl_faculties) ===\n");
    let facultyMatched = 0;
    let facultyUnmatched = 0;
    const unmatchedFaculties: string[] = [];
    for (const fText of facultyTexts) {
      const id = fuzzyMatch(fText, facultyMap, facultyMapNormalized);
      if (id) {
        console.log(`  ✅ "${fText}" → faculty_id=${id}`);
        facultyMatched++;
      } else {
        console.log(`  ❌ "${fText}" → NO MATCH`);
        unmatchedFaculties.push(fText);
        facultyUnmatched++;
      }
    }
    console.log(`\n  Faculty: ${facultyMatched} matched, ${facultyUnmatched} unmatched`);

    // Match department texts
    console.log("\n=== Department Matching (Excel \"department\" → tbl_departments) ===\n");
    let deptMatched = 0;
    let deptUnmatched = 0;
    const unmatchedDepts: string[] = [];
    for (const dText of departmentTexts) {
      const id = fuzzyMatch(dText, departmentMap, departmentMapNormalized);
      if (id) {
        console.log(`  ✅ "${dText}" → department_id=${id}`);
        deptMatched++;
      } else {
        console.log(`  ❌ "${dText}" → NO MATCH`);
        unmatchedDepts.push(dText);
        deptUnmatched++;
      }
    }
    console.log(`\n  Department: ${deptMatched} matched, ${deptUnmatched} unmatched`);

    // Per-row matching stats
    console.log("\n=== Per-Row Match Summary ===\n");
    let bothMatched = 0;
    let facultyOnlyMatched = 0;
    let deptOnlyMatched = 0;
    let neitherMatched = 0;
    let noFacultyText = 0;
    let noDeptText = 0;

    for (const row of data) {
      const fText = clean(row["Char"]);
      const dText = clean(row["department"]);
      const fId = fText ? fuzzyMatch(fText, facultyMap, facultyMapNormalized) : null;
      const dId = dText ? fuzzyMatch(dText, departmentMap, departmentMapNormalized) : null;

      if (!fText) noFacultyText++;
      if (!dText) noDeptText++;

      if (fId && dId) bothMatched++;
      else if (fId && !dId && dText) facultyOnlyMatched++;
      else if (!fId && fText && dId) deptOnlyMatched++;
      else if (fText || dText) neitherMatched++;
    }

    console.log(`  Both faculty & department matched: ${bothMatched}`);
    console.log(`  Only faculty matched (dept unmatched): ${facultyOnlyMatched}`);
    console.log(`  Only department matched (faculty unmatched): ${deptOnlyMatched}`);
    console.log(`  Neither matched: ${neitherMatched}`);
    console.log(`  Rows with no faculty text: ${noFacultyText}`);
    console.log(`  Rows with no department text: ${noDeptText}`);

    // Duplicate check against DB
    console.log("\n=== Duplicate Check (against existing DB) ===\n");
    let totalDuplicates = 0;
    let totalNewRecords = 0;

    // Batch check: get all existing sapids
    const existingSapids = new Set<string>();
    const existingRows = await sql`
      SELECT TRIM(COALESCE(sapid, '')) as sapid FROM public.tbl_alumni WHERE sapid IS NOT NULL AND sapid != ''
    ` as Array<{ sapid: string }>;
    for (const r of existingRows) {
      if (r.sapid) existingSapids.add(r.sapid.toLowerCase().trim());
    }
    console.log(`  Existing alumni records in DB: ${existingRows.length}`);

    for (const row of data) {
      const sapid = clean(row["SAP ID"]);
      if (sapid && existingSapids.has(sapid.toLowerCase().trim())) {
        totalDuplicates++;
      } else {
        totalNewRecords++;
      }
    }

    console.log(`  Duplicates (SAP ID already in DB): ${totalDuplicates}`);
    console.log(`  New records (not in DB): ${totalNewRecords}`);
    console.log(`  Total Excel rows: ${data.length}`);

    // Status reference
    console.log("\n=== Status Reference (existing DB) ===\n");
    const statusCheck = await sql`
      SELECT
        COUNT(DISTINCT alumniid) FILTER (WHERE LOWER(TRIM(COALESCE(verify, ''))) = 'underapproval') as under_approval,
        COUNT(DISTINCT alumniid) FILTER (WHERE LOWER(TRIM(COALESCE(verify, ''))) = 'true') as verified,
        COUNT(DISTINCT alumniid) FILTER (WHERE LOWER(TRIM(COALESCE(verify, ''))) = 'false') as unverified,
        COUNT(DISTINCT alumniid) as total
      FROM public.tbl_alumni
    `;
    console.log(`  Total alumni in DB: ${statusCheck[0].total}`);
    console.log(`  verify='underApproval': ${statusCheck[0].under_approval}`);
    console.log(`  verify='true' (verified): ${statusCheck[0].verified}`);
    console.log(`  verify='false' (unverified): ${statusCheck[0].unverified}`);

    // Final summary
    console.log("\n" + "=".repeat(60));
    console.log("=== SANITY CHECK SUMMARY ===");
    console.log("=".repeat(60));
    console.log(`Excel rows: ${data.length}`);
    console.log(`New records to insert: ${totalNewRecords}`);
    console.log(`Duplicates (will be skipped): ${totalDuplicates}`);
    console.log(`Faculty match rate: ${facultyMatched}/${facultyTexts.size} unique values`);
    console.log(`Department match rate: ${deptMatched}/${departmentTexts.size} unique values`);
    console.log(`Rows with both faculty+dept matched: ${bothMatched}`);
    console.log(`\nNew records will be inserted with:`);
    console.log(`  verify = 'underApproval' (new registration, awaiting admin approval)`);
    console.log(`  change_approval = NULL (no pending profile changes)`);
    console.log(`  faculty = matched faculty_id from tbl_faculties`);
    console.log(`  department = matched department_id from tbl_departments`);
    console.log(`  program = NULL (no program column in Excel)`);
    console.log(`  datasource = 'Excel Import 2026'`);

    if (unmatchedFaculties.length > 0) {
      console.log(`\n⚠️  UNMATCHED FACULTIES (will have faculty=NULL):`);
      for (const f of unmatchedFaculties) console.log(`  - "${f}"`);
    }
    if (unmatchedDepts.length > 0) {
      console.log(`\n⚠️  UNMATCHED DEPARTMENTS (will have department=NULL):`);
      for (const d of unmatchedDepts) console.log(`  - "${d}"`);
    }

  } catch (dbErr: any) {
    console.error("❌ Database connection failed:", dbErr.message);
    console.error("   Please start the database and re-run the sanity check.");
  }

  console.log("\n=== Sanity Check Complete ===");
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("Sanity check failed:", e);
  process.exit(1);
});
