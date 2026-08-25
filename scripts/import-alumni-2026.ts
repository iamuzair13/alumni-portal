import XLSX from "xlsx";
import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not set in .env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
  prepare: false,
});

const BATCH_SIZE = 100;
const DATASOURCE = "Excel Import 2026";

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

// Extract a year (4-digit) from a value that may be an Excel date serial, a string date, or a number
function extractYear(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    // Excel date serial
    if (value > 20000 && value < 60000) {
      try {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + value * 86400000);
        return date.getFullYear();
      } catch {
        return null;
      }
    }
    // Already a year
    if (value >= 1950 && value <= 2100) return Math.floor(value);
    return null;
  }
  if (typeof value === "string") {
    const s = value.trim();
    // Try parsing as a year directly
    const asNum = Number(s);
    if (!isNaN(asNum) && asNum >= 1950 && asNum <= 2100) return Math.floor(asNum);
    // Try parsing as a date
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.getFullYear();
    // Try regex for a 4-digit year
    const m = s.match(/\b(19|20)\d{2}\b/);
    if (m) return Number(m[0]);
  }
  return null;
}

const normalize = (s: string): string =>
  s.toLowerCase().trim().replace(/\s+/g, " ").replace(/\band\b/g, "&");

async function main() {
  const excelPath = "C:\\Users\\chuza\\Downloads\\Alumni 2026 REVISED SHEET.xlsx";
  console.log(`📊 Starting import...`);
  console.log(`📁 File: ${excelPath}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log(`🏷️  datasource: "${DATASOURCE}"`);
  console.log(`✅ verify: 'underApproval' (new registrations awaiting admin approval)\n`);

  // Read Excel
  const workbook = XLSX.readFile(excelPath, { cellDates: true, dateNF: "yyyy-mm-dd" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null }) as any[];
  console.log(`📄 Sheet: "${sheetName}" — ${data.length} rows\n`);

  // Fetch faculties and departments from DB
  const faculties = await sql`
    SELECT id, faculty_name FROM public.tbl_faculties
  ` as Array<{ id: bigint; faculty_name: string | null }>;
  const departments = await sql`
    SELECT id, department_name FROM public.tbl_departments
  ` as Array<{ id: bigint; department_name: string | null }>;

  // Build fuzzy lookup maps
  const facultyExact = new Map<string, bigint>();
  const facultyNorm = new Map<string, bigint>();
  for (const f of faculties) {
    if (f.faculty_name) {
      facultyExact.set(f.faculty_name.toLowerCase().trim(), f.id);
      facultyNorm.set(normalize(f.faculty_name), f.id);
    }
  }
  const deptExact = new Map<string, bigint>();
  const deptNorm = new Map<string, bigint>();
  for (const d of departments) {
    if (d.department_name) {
      deptExact.set(d.department_name.toLowerCase().trim(), d.id);
      deptNorm.set(normalize(d.department_name), d.id);
    }
  }

  const fuzzyMatch = (
    text: string,
    exactMap: Map<string, bigint>,
    normMap: Map<string, bigint>
  ): bigint | null => {
    const key = text.toLowerCase().trim();
    if (exactMap.has(key)) return exactMap.get(key)!;
    const normKey = normalize(text);
    if (normMap.has(normKey)) return normMap.get(normKey)!;
    for (const [k, v] of normMap) {
      if (k.startsWith(normKey) || normKey.startsWith(k)) return v;
    }
    return null;
  };

  // Fetch existing SAP IDs for duplicate check
  console.log("🔍 Fetching existing SAP IDs from DB for duplicate check...");
  const existingSapids = new Set<string>();
  const existingRows = await sql`
    SELECT TRIM(COALESCE(sapid, '')) as sapid FROM public.tbl_alumni WHERE sapid IS NOT NULL AND sapid != ''
  ` as Array<{ sapid: string }>;
  for (const r of existingRows) {
    if (r.sapid) existingSapids.add(r.sapid.toLowerCase().trim());
  }
  console.log(`   Found ${existingRows.length} existing alumni records\n`);

  // Build records to insert (skip duplicates)
  const records: any[] = [];
  let skippedDuplicate = 0;
  let skippedNoSapid = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const sapid = clean(row["SAP ID"]);

    if (!sapid) {
      skippedNoSapid++;
      continue;
    }

    if (existingSapids.has(sapid.toLowerCase().trim())) {
      skippedDuplicate++;
      continue;
    }

    const name = clean(row["Name"]);
    const email = cleanEmail(row["Email"]);
    const cnic = clean(row["CNIC"]);
    const fatherName = clean(row["Father Name"]);
    const gender = clean(row["Gender"]);
    const contactNo = clean(row["Contact No"]);
    const degreeName = clean(row["Degree Name"]);
    const deptText = clean(row["department"]);
    const facultyText = clean(row["Char"]);
    const campus = clean(row["campus"]);
    const occupationStatus = clean(row["occupation status"]);
    const startDate = row["Start date"];
    const endDate = row["End Date"];
    const companyName = clean(row["Company Name"]);
    const designation = clean(row["Designation"]);
    const industry = clean(row["Industry"]);
    const currentCountry = clean(row["Current Country"]);
    const currentCity = clean(row["Current City"]);
    const linkedin = clean(row["LinkedIn"]);

    // Resolve faculty and department IDs
    const facultyId = facultyText ? fuzzyMatch(facultyText, facultyExact, facultyNorm) : null;
    const departmentId = deptText ? fuzzyMatch(deptText, deptExact, deptNorm) : null;

    // Resolve email — generate default if missing
    const alumniemail = email || (sapid ? `alumni_${sapid}@uol.edu.pk` : null);
    if (!alumniemail) {
      skippedNoSapid++;
      continue;
    }

    // Map "Current Country" PK → "Pakistan" if it's the country code
    let country = currentCountry;
    if (country && country.toUpperCase() === "PK") country = "Pakistan";

    // Map occupation status to employeed field
    let employeed: string | null = occupationStatus;
    if (employeed) {
      const lower = employeed.toLowerCase();
      if (lower.includes("unemployed")) employeed = "Unemployed";
      else if (lower.includes("employ") || lower.includes("working") || lower.includes("self")) {
        employeed = "Employed";
      }
    }

    records.push({
      alumniemail,
      password: null,
      todaydate: new Date(),
      registrationno: null,
      sapid,
      alumniname: name,
      gender,
      fathername: fatherName,
      dateofbirth: null,
      maritalstatus: null,
      cnicpassport: cnic,
      contactno: contactNo,
      contactno1: null,
      contactno1show: null,
      personalemail: email,
      personalemailshow: null,
      universityemail: null,
      country,
      province: null,
      city: currentCity,
      address: null,
      academicsession: null,
      degreetitle: degreeName,
      cgpa: null,
      yearofstarting: extractYear(startDate),
      yearofending: extractYear(endDate),
      facultyname: facultyText,
      campusname: campus,
      departmentname: deptText,
      majorsubject: null,
      industry,
      employeed,
      nameoforganization: companyName,
      designation,
      totalyearsofexpereince: null,
      officialemail: null,
      officialnumber: null,
      image1: null,
      cv: null,
      aboutme: null,
      lasttimelogin: null,
      logincount: 0,
      verify: "underApproval",
      emailsendcount: 0,
      emailsendstatus: null,
      createddatetime: new Date().toISOString(),
      facebook: null,
      instagram: null,
      youtube: null,
      linkedin,
      datasource: DATASOURCE,
      alumnistatus: null,
      degree_title: degreeName,
      higher_education_institute_name: null,
      higher_education_program: null,
      is_scholarship: null,
      faculty: facultyId,
      department: departmentId,
      program: null,
      change_approval: null,
    });
  }

  console.log(`📋 Records to insert: ${records.length}`);
  console.log(`⏭️  Skipped duplicates (SAP ID already in DB): ${skippedDuplicate}`);
  console.log(`⏭️  Skipped no SAP ID: ${skippedNoSapid}\n`);

  if (records.length === 0) {
    console.log("✅ No new records to insert. Exiting.");
    await sql.end();
    return;
  }

  // Insert in batches
  const batches: any[][] = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    batches.push(records.slice(i, i + BATCH_SIZE));
  }
  console.log(`🔄 Processing ${batches.length} batches...\n`);

  let totalInserted = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const startTime = Date.now();
    let batchInserted = 0;
    let batchFailed = 0;

    try {
      await sql.begin(async (tx) => {
        for (const r of batch) {
          try {
            await tx`
              INSERT INTO public.tbl_alumni (
                alumniemail, password, todaydate, registrationno, sapid, alumniname,
                gender, fathername, dateofbirth, maritalstatus, cnicpassport,
                contactno, contactno1, contactno1show, personalemail, personalemailshow,
                universityemail, country, province, city, address, academicsession,
                degreetitle, cgpa, yearofstarting, yearofending, facultyname, campusname,
                departmentname, majorsubject, industry, employeed, nameoforganization,
                designation, totalyearsofexpereince, officialemail, officialnumber,
                image1, cv, aboutme, lasttimelogin, logincount, verify, emailsendcount,
                emailsendstatus, createddatetime, facebook, instagram, youtube, linkedin,
                datasource, alumnistatus, degree_title, higher_education_institute_name,
                higher_education_program, is_scholarship, faculty, department, program,
                change_approval
              ) VALUES (
                ${r.alumniemail}, ${r.password}, ${r.todaydate}, ${r.registrationno},
                ${r.sapid}, ${r.alumniname}, ${r.gender}, ${r.fathername},
                ${r.dateofbirth}, ${r.maritalstatus}, ${r.cnicpassport},
                ${r.contactno}, ${r.contactno1}, ${r.contactno1show},
                ${r.personalemail}, ${r.personalemailshow}, ${r.universityemail},
                ${r.country}, ${r.province}, ${r.city}, ${r.address},
                ${r.academicsession}, ${r.degreetitle}, ${r.cgpa},
                ${r.yearofstarting}, ${r.yearofending}, ${r.facultyname},
                ${r.campusname}, ${r.departmentname}, ${r.majorsubject},
                ${r.industry}, ${r.employeed}, ${r.nameoforganization},
                ${r.designation}, ${r.totalyearsofexpereince}, ${r.officialemail},
                ${r.officialnumber}, ${r.image1}, ${r.cv}, ${r.aboutme},
                ${r.lasttimelogin}, ${r.logincount}, ${r.verify}, ${r.emailsendcount},
                ${r.emailsendstatus}, ${r.createddatetime}, ${r.facebook},
                ${r.instagram}, ${r.youtube}, ${r.linkedin}, ${r.datasource},
                ${r.alumnistatus}, ${r.degree_title}, ${r.higher_education_institute_name},
                ${r.higher_education_program}, ${r.is_scholarship},
                ${r.faculty}, ${r.department}, ${r.program}, ${r.change_approval}
              )
            `;
            batchInserted++;
          } catch (err: any) {
            batchFailed++;
            errors.push(`SAP ${r.sapid}: ${err.message}`);
          }
        }
      });
    } catch (txErr: any) {
      // Whole batch transaction failed
      batchFailed = batch.length - batchInserted;
      errors.push(`Batch ${i + 1} transaction failed: ${txErr.message}`);
    }

    totalInserted += batchInserted;
    totalFailed += batchFailed;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`  ✅ Batch ${i + 1}/${batches.length}: ${batchInserted} inserted, ${batchFailed} failed (${elapsed}s)`);

    // Small delay between batches
    if (i < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 IMPORT SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Total inserted: ${totalInserted}`);
  console.log(`❌ Total failed: ${totalFailed}`);
  console.log(`⏭️  Skipped duplicates: ${skippedDuplicate}`);
  console.log(`⏭️  Skipped no SAP ID: ${skippedNoSapid}`);
  console.log(`📋 Total Excel rows: ${data.length}`);
  if (data.length > 0) {
    const rate = ((totalInserted / data.length) * 100).toFixed(2);
    console.log(`📈 Insert rate: ${rate}% of Excel rows`);
  }

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} errors:`);
    errors.slice(0, 20).forEach((e, idx) => console.log(`   ${idx + 1}. ${e}`));
    if (errors.length > 20) console.log(`   ... and ${errors.length - 20} more`);
  }

  // Verify the new records
  console.log("\n=== Verification ===\n");
  const verifyCheck = await sql`
    SELECT
      COUNT(*) as total_new,
      COUNT(*) FILTER (WHERE verify = 'underApproval') as under_approval,
      COUNT(*) FILTER (WHERE faculty IS NOT NULL) as with_faculty,
      COUNT(*) FILTER (WHERE department IS NOT NULL) as with_department,
      COUNT(*) FILTER (WHERE datasource = ${DATASOURCE}) as with_datasource
    FROM public.tbl_alumni
    WHERE datasource = ${DATASOURCE}
  `;
  console.log(`  Records with datasource='${DATASOURCE}': ${verifyCheck[0].total_new}`);
  console.log(`    verify='underApproval': ${verifyCheck[0].under_approval}`);
  console.log(`    with faculty_id: ${verifyCheck[0].with_faculty}`);
  console.log(`    with department_id: ${verifyCheck[0].with_department}`);

  console.log("\n✅ Import complete.");
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Import failed:", e);
  process.exit(1);
});
