/**
 * T0.2 — Seed synthetic alumni rows for performance baselines.
 *
 *   npx tsx scripts/seed-perf-data.ts            # insert 50,000 rows
 *   SEED_COUNT=100000 npx tsx scripts/seed-perf-data.ts
 *   npx tsx scripts/seed-perf-data.ts --cleanup  # delete ONLY rows tagged datasource='PERF_SEED'
 *
 * Rows are tagged datasource='PERF_SEED' and sapid='PERF######' so they can be
 * removed safely without touching real data. Faculty/department/program are
 * sampled from EXISTING org rows to keep FK relationships consistent.
 */
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const BATCH = 1000;
const COUNT = Number(process.env.SEED_COUNT ?? 50_000);
const CLEANUP = process.argv.includes("--cleanup");

const FIRST = ["Ahmed","Ali","Zafar","Hassan","Usman","Bilal","Imran","Faisal","Kamran","Naveed","Sana","Ayesha","Fatima","Zainab","Mariam","Hira","Noor","Iqra","Mahnoor","Amna","Hamza","Talha","Umar","Saad","Waqas","Shahid","Rizwan","Danish","Arslan","Junaid"];
const LAST = ["Khan","Ahmed","Ali","Hussain","Shah","Malik","Raza","Aslam","Akhtar","Iqbal","Chaudhry","Butt","Sheikh","Rana","Mirza","Baig","Siddiqui","Qureshi","Hashmi","Javed","Anwar","Nadeem","Tariq","Latif","Aziz"];
const CITIES = ["Lahore","Karachi","Islamabad","Rawalpindi","Faisalabad","Multan","Gujranwala","Sialkot","Peshawar","Quetta","Bahawalpur","Sargodha","Hyderabad","Abbottabad","Jhelum"];
const PROVINCES = ["Punjab","Punjab","Punjab","Punjab","Sindh","Khyber Pakhtunkhwa","Islamabad","Balochistan","AJK","Gilgit Baltistan"];
const COUNTRIES = ["Pakistan","Pakistan","Pakistan","Pakistan","Pakistan","Pakistan","Pakistan","Pakistan","UAE","Saudi Arabia","UK","USA","Canada","Australia"];
const EMPLOYERS = ["Systems Limited","Netsol","Telenor","Jazz","HBL","UBL","MCB","PTCL","Nestle","Unilever","Packages Ltd","Descon","Fatima Group","Engro","Self Employed","Government","Freelance","","",""];
const INDUSTRIES = ["IT","Banking","Telecom","Education","Healthcare","Manufacturing","Government","Retail","Consulting","Media"];
const CAMPUSES = ["Lahore","Lahore","Lahore","Islamabad","Sargodha","Pakpattan","Gujrat"];
const DESIGNATIONS = ["Software Engineer","Manager","Analyst","Lecturer","Officer","Consultant","Director","Executive","Intern","Businessman"];
const HIGHER_ED = ["","","","","","MS Computer Science","MBA","MS Management Sciences","PhD","LLM"];
const OCCUPATION = ["Employed","Employed","Employed","Self-employed","Entrepreneur","Searching","By choice",""];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 4, prepare: false });

  if (CLEANUP) {
    const r = await sql`DELETE FROM public.tbl_alumni WHERE datasource = 'PERF_SEED'`;
    console.log(`Deleted ${r.count} PERF_SEED rows`);
    await sql.end();
    return;
  }

  // Sample existing org ids so FK relationships stay valid.
  const faculties = await sql`SELECT id FROM public.tbl_faculties ORDER BY id`;
  const departments = await sql`SELECT id, faculty_id FROM public.tbl_departments ORDER BY id`;
  const programs = await sql`SELECT id, department_id FROM public.tbl_programs ORDER BY id`;
  const deptById = new Map(departments.map((d) => [d.id as number, d]));
  const progsByDept = new Map<number, number[]>();
  for (const p of programs) {
    const list = progsByDept.get(p.department_id as number) ?? [];
    list.push(p.id as number);
    progsByDept.set(p.department_id as number, list);
  }
  const deptIds = departments.map((d) => d.id as number);
  const facIds = faculties.map((f) => f.id as number);
  if (!facIds.length) {
    console.warn("No faculties found — faculty/department/program will be NULL");
  }

  const existing = await sql`SELECT COUNT(*)::int AS c FROM public.tbl_alumni WHERE datasource = 'PERF_SEED'`;
  if (existing[0].c > 0) {
    console.log(`Found ${existing[0].c} existing PERF_SEED rows — run with --cleanup first if you want a fresh set`);
  }

  console.log(`Seeding ${COUNT} rows into public.tbl_alumni (batch ${BATCH})...`);
  const t0 = Date.now();
  let inserted = 0;

  for (let start = 0; start < COUNT; start += BATCH) {
    const size = Math.min(BATCH, COUNT - start);
    const names: string[] = [], fathers: string[] = [], genders: string[] = [];
    const marital: string[] = [], cnic: string[] = [], phones: string[] = [];
    const pEmails: string[] = [], uEmails: string[] = [], aEmails: string[] = [];
    const countries: string[] = [], provinces: string[] = [], cities: string[] = [];
    const sessions: string[] = [], cgpas: number[] = [];
    const yStart: number[] = [], yEnd: number[] = [];
    const campuses: string[] = [], industries: string[] = [];
    const employed: string[] = [], orgs: string[] = [], desigs: string[] = [];
    const workCities: string[] = [], workCountries: string[] = [], oEmails: string[] = [];
    const verifies: (string | null)[] = [], regnos: string[] = [], sapids: string[] = [];
    const facs: (number | null)[] = [], depts: (number | null)[] = [], progs: (number | null)[] = [];
    const cats: string[] = [], higherEd: string[] = [], loginCounts: number[] = [];
    const dsource: string[] = [], astatus: string[] = [], tdate: string[] = [];

    for (let i = 0; i < size; i++) {
      const n = start + i;
      const deptId = deptIds.length ? pick(deptIds) : null;
      const dept = deptId !== null ? deptById.get(deptId) : undefined;
      const progIds = deptId !== null ? progsByDept.get(deptId) : undefined;
      const firstName = pick(FIRST), lastName = pick(LAST);
      const fullName = `${firstName} ${lastName}`;
      const gender = Math.random() < 0.75 ? "Male" : "Female";

      names.push(fullName);
      fathers.push(`${pick(FIRST)} ${lastName}`);
      genders.push(gender);
      marital.push(Math.random() < 0.6 ? "Married" : "Single");
      cnic.push(`35202-${randInt(1000000, 9999999)}-${Math.random() < 0.5 ? 1 : 2}`);
      phones.push(`03${randInt(10, 49)}-${randInt(1000000, 9999999)}`);
      pEmails.push(`perf${n}@seed.invalid`);
      uEmails.push(`perf${n}@students.uol.edu.pk`);
      aEmails.push(`perf${n}@seed.invalid`);
      countries.push(pick(COUNTRIES));
      provinces.push(pick(PROVINCES));
      cities.push(pick(CITIES));
      const ys = randInt(2000, 2020);
      yStart.push(ys);
      yEnd.push(ys + 4);
      sessions.push(`${ys}-${String(ys + 4).slice(2)}`);
      cgpas.push(Math.round(rand(2.0, 4.0) * 100) / 100);
      campuses.push(pick(CAMPUSES));
      industries.push(pick(INDUSTRIES));
      employed.push(pick(OCCUPATION));
      orgs.push(pick(EMPLOYERS));
      desigs.push(pick(DESIGNATIONS));
      workCities.push(pick(CITIES));
      workCountries.push(pick(COUNTRIES));
      oEmails.push(`perf${n}@work.invalid`);
      const r = Math.random();
      verifies.push(r < 0.7 ? "true" : r < 0.85 ? "false" : r < 0.95 ? "underApproval" : null);
      regnos.push(`PERF-${String(n).padStart(6, "0")}`);
      sapids.push(`PERF${String(n).padStart(6, "0")}`);
      facs.push(dept ? (dept.faculty_id as number) : pick(facIds) ?? null);
      depts.push(deptId);
      progs.push(progIds?.length ? pick(progIds) : null);
      cats.push(Math.random() < 0.08 ? pick(["A+","A","B","C","D"]) : "");
      higherEd.push(pick(HIGHER_ED));
      loginCounts.push(Math.random() < 0.7 ? randInt(1, 40) : 0);
      dsource.push("PERF_SEED");
      astatus.push("active");
      tdate.push(new Date(Date.now() - randInt(0, 1000 * 86400 * 365)).toISOString());
    }

    await sql`
      INSERT INTO public.tbl_alumni (
        alumniname, fathername, gender, maritalstatus, cnicpassport, contactno,
        personalemail, universityemail, alumniemail,
        country, province, city, academicsession, cgpa,
        yearofstarting, yearofending, campusname,
        industry, employeed, nameoforganization, designation,
        work_city, work_country, officialemail,
        verify, registrationno, sapid, faculty, department, program,
        category, higher_education_program, logincount,
        datasource, alumnistatus, todaydate
      )
      SELECT * FROM UNNEST(
        ${names}::varchar[], ${fathers}::varchar[], ${genders}::varchar[],
        ${marital}::varchar[], ${cnic}::varchar[], ${phones}::varchar[],
        ${pEmails}::varchar[], ${uEmails}::varchar[], ${aEmails}::varchar[],
        ${countries}::varchar[], ${provinces}::varchar[], ${cities}::varchar[],
        ${sessions}::varchar[], ${cgpas}::float8[],
        ${yStart}::int[], ${yEnd}::int[],
        ${campuses}::varchar[], ${industries}::text[],
        ${employed}::text[], ${orgs}::varchar[], ${desigs}::varchar[],
        ${workCities}::text[], ${workCountries}::text[], ${oEmails}::varchar[],
        ${verifies}::varchar[], ${regnos}::varchar[], ${sapids}::varchar[],
        ${facs}::bigint[], ${depts}::bigint[], ${progs}::bigint[],
        ${cats}::text[], ${higherEd}::text[], ${loginCounts}::int[],
        ${dsource}::varchar[], ${astatus}::varchar[], ${tdate}::timestamp[]
      )
    `;
    inserted += size;
    if ((start / BATCH) % 10 === 0) console.log(`  ${inserted}/${COUNT}`);
  }

  console.log(`Done: ${inserted} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
