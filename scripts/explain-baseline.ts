/**
 * T0.2 — EXPLAIN (ANALYZE, BUFFERS) baseline.
 *
 * Reproduces the real SQL emitted by the heavy routes (copied from the route
 * handlers — filter fragments expanded to representative literals) and runs
 * them under EXPLAIN (ANALYZE, BUFFERS). Results are appended to
 * docs/perf/baseline.md.
 *
 *   npx tsx scripts/explain-baseline.ts            # analyze (executes queries!)
 *   EXPLAIN_ONLY=1 npx tsx scripts/explain-baseline.ts   # plan only, no ANALYZE
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const ANALYZE = process.env.EXPLAIN_ONLY !== "1";

type Named = { name: string; source: string; sql: string };

const LIST_COLUMNS = `
  a.alumniid, a.registrationno, a.sapid, a.alumniname, a.gender, a.fathername,
  a.maritalstatus, a.cnicpassport,
  f.faculty_name as facultyname, a.campusname, d.department_name as departmentname,
  p.program_name as degreetitle, a.yearofstarting, a.yearofending,
  a.country, a.city, a.province, a.verify, a.employeed, a.industry,
  a.work_city, a.work_country, a.nameoforganization, a.designation,
  a.higher_education_institute_name, a.higher_education_program, a.is_scholarship,
  a.higher_education_institute_country, a.higher_education_institute_city,
  a.officialnumber, a.officialemail, a.personalemail, a.createddatetime,
  a.contactno, a.contactno1, a.lasttimelogin, a.logincount, a.category,
  COALESCE(c1.national_chapter, c1.international_chapter) as chapter1name`;

const LIST_JOINS = `
  FROM public.tbl_alumni a
  LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
  LEFT JOIN public.tbl_departments d ON d.id = a.department
  LEFT JOIN public.tbl_programs p ON p.id = a.program
  LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
  LEFT JOIN public.tblchapters c1 ON c1.id = ac."chapter1"`;

const QUERIES: Named[] = [
  {
    name: "alumni-list-default",
    source: "GET /api/alumni (no filters)",
    sql: `SELECT ${LIST_COLUMNS} ${LIST_JOINS}
      WHERE 1=1
      ORDER BY a.alumniid DESC
      LIMIT 100 OFFSET 0`,
  },
  {
    name: "alumni-search-3filters",
    source: "GET /api/alumni?search=zafar&gender=Male&homeCountry=Pakistan&campusname=Lahore",
    sql: `SELECT ${LIST_COLUMNS} ${LIST_JOINS}
      WHERE 1=1
        AND LOWER(TRIM(COALESCE(gender, ''))) = LOWER(TRIM('Male'))
        AND LOWER(TRIM(COALESCE(country, ''))) = LOWER(TRIM('Pakistan'))
        AND LOWER(TRIM(COALESCE(campusname, ''))) = LOWER(TRIM('Lahore'))
        AND (
          LOWER(CAST(a.alumniid AS TEXT)) LIKE '%zafar%'
          OR LOWER(COALESCE(a.sapid, '')) LIKE '%zafar%'
          OR LOWER(COALESCE(a.registrationno, '')) LIKE '%zafar%'
          OR LOWER(COALESCE(a.alumniname, '')) LIKE '%zafar%'
          OR LOWER(COALESCE(a.personalemail, '')) LIKE '%zafar%'
          OR LOWER(COALESCE(a.officialemail, '')) LIKE '%zafar%'
          OR LOWER(COALESCE(f.faculty_name, '')) LIKE '%zafar%'
          OR LOWER(COALESCE(d.department_name, '')) LIKE '%zafar%'
          OR LOWER(COALESCE(p.program_name, '')) LIKE '%zafar%'
        )
      ORDER BY a.alumniid DESC
      LIMIT 100 OFFSET 0`,
  },
  {
    name: "alumni-counts",
    source: "GET /api/alumni/counts (no filters)",
    sql: `SELECT
        COUNT(DISTINCT a.alumniid) as total,
        COUNT(DISTINCT a.alumniid) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true') as verified,
        COUNT(DISTINCT a.alumniid) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'false') as unverified,
        COUNT(DISTINCT a.alumniid) FILTER (WHERE LOWER(TRIM(COALESCE(a.verify, ''))) = 'underapproval') as under_approval,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE (a.lasttimelogin IS NOT NULL AND a.lasttimelogin != '')
             OR (a.logincount IS NOT NULL AND a.logincount > 0)) as active,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE (a.lasttimelogin IS NULL OR a.lasttimelogin = '')
            AND (a.logincount IS NULL OR a.logincount = 0)) as inactive,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.category, ''))) = 'a+'
             OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a+%') as category_a_plus,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE (LOWER(TRIM(COALESCE(a.category, ''))) = 'a'
             OR (LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a%'
             AND LOWER(TRIM(COALESCE(a.category, ''))) NOT LIKE 'a+%'))) as category_a,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.category, ''))) = 'b'
             OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'b%') as category_b,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.category, ''))) = 'c'
             OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'c%') as category_c,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.category, ''))) = 'd'
             OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'd%') as category_d,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.medal, ''))) = 'gold medalist') as medal_gold,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.medal, ''))) = 'silver medalist') as medal_silver,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(TRIM(COALESCE(a.medal, ''))) = 'bronze medalist') as medal_bronze
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE 1=1`,
  },
  {
    name: "filter-options-employers",
    source: "GET /api/alumni/employers (one of ~25 identical endpoints)",
    sql: `SELECT
        CASE WHEN a.nameoforganization IS NULL OR TRIM(COALESCE(a.nameoforganization, '')) = ''
          THEN 'Null' ELSE TRIM(a.nameoforganization) END as employer_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE 1=1
        AND LOWER(TRIM(COALESCE(gender, ''))) = LOWER(TRIM('Male'))
      GROUP BY
        CASE WHEN a.nameoforganization IS NULL OR TRIM(COALESCE(a.nameoforganization, '')) = ''
          THEN 'Null' ELSE TRIM(a.nameoforganization) END
      ORDER BY
        CASE WHEN a.nameoforganization IS NULL OR TRIM(COALESCE(a.nameoforganization, '')) = ''
          THEN 'Null' ELSE TRIM(a.nameoforganization) END ASC`,
  },
  {
    name: "alumni-cards-applicants",
    source: "GET /api/alumni-cards/applicants",
    sql: `SELECT c.alumniid, c.status, c.createdat, a.alumniname, a.sapid, a.registrationno,
        a.personalemail, a.contactno, f.faculty_name, d.department_name, p.program_name
      FROM public.tblcard c
      JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE (c.status IS NULL OR TRIM(c.status) = '' OR UPPER(TRIM(c.status)) = 'PENDING')
      ORDER BY c.createdat DESC`,
  },

  // ── realtime-dashboard representative queries ──
  {
    name: "dash-kpi-alumni",
    source: "/api/analytics/realtime-dashboard (kpiRows)",
    sql: `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify,'')) = 'true')::int AS verified,
        COUNT(*) FILTER (WHERE COALESCE(a.logincount,0) >= 1 OR TRIM(COALESCE(a.lasttimelogin,'')) <> '')::int AS active
      FROM public.tbl_alumni a WHERE 1=1`,
  },
  {
    name: "dash-faculty-registrations",
    source: "realtime-dashboard facultyRegistrations",
    sql: `SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), 'Under Processing') AS faculty,
        COUNT(*)::int AS registrations,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true')::int AS verified,
        COUNT(*) FILTER (WHERE
          COALESCE(a.logincount, 0) >= 1 OR TRIM(COALESCE(a.lasttimelogin, '')) <> '')::int AS active
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      GROUP BY 1
      ORDER BY 2 DESC`,
  },
  {
    name: "dash-faculty-categories",
    source: "realtime-dashboard facultyCategoryRows",
    sql: `SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), 'Under Processing') AS faculty,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'a+'
              OR LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a+%'))::int AS a_plus,
        COUNT(DISTINCT a.alumniid) FILTER (
          WHERE LOWER(COALESCE(a.verify, '')) = 'true'
            AND (LOWER(TRIM(COALESCE(a.category, ''))) = 'a'
              OR (LOWER(TRIM(COALESCE(a.category, ''))) LIKE 'a%'
              AND LOWER(TRIM(COALESCE(a.category, ''))) NOT LIKE 'a+%')))::int AS a
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      GROUP BY 1`,
  },
  {
    name: "dash-faculty-occupations",
    source: "realtime-dashboard facultyOccupationRows",
    sql: `SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), 'Under Processing') AS faculty,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND LOWER(TRIM(COALESCE(a.employeed,''))) IN ('employed','employed/business'))::int AS employed,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND (LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%self-employed%'
            OR LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%entrepreneur%'))::int AS self_employed,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%searching%')::int AS unemployed_searching,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND LOWER(TRIM(COALESCE(a.employeed,''))) LIKE '%choice%')::int AS unemployed_choice,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND TRIM(COALESCE(a.employeed,'')) <> '')::int AS with_status
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      GROUP BY 1
      ORDER BY 6 DESC`,
  },
  {
    name: "dash-faculty-transitions",
    source: "realtime-dashboard facultyTransitionRows",
    sql: `SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), 'Under Processing') AS faculty,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) = 'before graduation')::int AS before_graduation,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%immediately%')::int AS immediate,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%within 3 month%')::int AS within_3,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%within 6 month%')::int AS within_6,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND LOWER(TRIM(COALESCE(a.occupation_transition_timing,''))) LIKE '%after 6 month%')::int AS after_6,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND TRIM(COALESCE(a.occupation_transition_timing,'')) <> '')::int AS unknown_bucket,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true')::int AS verified_total
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      GROUP BY 1
      ORDER BY 8 DESC`,
  },
  {
    name: "dash-faculty-locations",
    source: "realtime-dashboard facultyLocationRows (province buckets)",
    sql: `SELECT
        COALESCE(NULLIF(TRIM(f.faculty_name), ''), 'Under Processing') AS faculty,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND LOWER(TRIM(COALESCE(a.province,''))) LIKE '%punjab%'
          AND LOWER(TRIM(COALESCE(a.province,''))) NOT LIKE '%islamabad%')::int AS punjab,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND (LOWER(TRIM(COALESCE(a.province,''))) LIKE '%islamabad%'
            OR LOWER(TRIM(COALESCE(a.province,''))) LIKE '%ict%'))::int AS islamabad,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND LOWER(TRIM(COALESCE(a.province,''))) LIKE '%sindh%')::int AS sindh,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true'
          AND TRIM(COALESCE(a.country,'')) <> ''
          AND LOWER(TRIM(COALESCE(a.country,''))) NOT LIKE '%pakistan%')::int AS overseas,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.verify, '')) = 'true')::int AS verified_total
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE 1=1
      GROUP BY 1
      ORDER BY verified_total DESC`,
  },
  {
    name: "dash-chapter-counts",
    source: "realtime-dashboard chapterAssocRows",
    sql: `SELECT
        (SELECT COUNT(*)::int FROM public.tblchapters c WHERE TRIM(COALESCE(c.national_chapter,'')) <> '') AS national_chapters,
        (SELECT COUNT(*)::int FROM public.tblchapters c WHERE TRIM(COALESCE(c.international_chapter,'')) <> '') AS international_chapters,
        (SELECT COUNT(DISTINCT fid)::int FROM (SELECT a.association_id AS fid FROM public.tbl_alumni a WHERE a.association_id IS NOT NULL) t) AS associations,
        (SELECT COUNT(DISTINCT ac.id)::int FROM public.alumni_chapter ac JOIN public.tbl_alumni a ON a.alumniid = ac.id WHERE 1=1) AS chapter_members`,
  },
  {
    name: "dash-chapter-members-national",
    source: "realtime-dashboard chapter member counts",
    sql: `SELECT TRIM(c.national_chapter) AS chapter, COUNT(ac.id)::int AS members
      FROM public.tblchapters c
      LEFT JOIN public.alumni_chapter ac ON ac."chapter1" = c.id OR ac."chapter2" = c.id OR ac."chapter3" = c.id
      WHERE TRIM(COALESCE(c.national_chapter,'')) <> ''
      GROUP BY TRIM(c.national_chapter)
      ORDER BY members DESC`,
  },
  {
    name: "dash-card-status",
    source: "realtime-dashboard card counts",
    sql: `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE c.status IS NULL OR TRIM(c.status) = '' OR UPPER(TRIM(c.status)) = 'PENDING')::int AS under_review,
        COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(c.status,''))) = 'DELIVERED')::int AS delivered
      FROM public.tblcard c`,
  },
  {
    name: "dash-scholarship-counts",
    source: "realtime-dashboard scholarship aggregate",
    sql: `SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status,'')) = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status,'')) = 'underreview' OR s.status IS NULL)::int AS under_review
      FROM public.alumni_scholarships s`,
  },
];

function extractSummary(planText: string) {
  const exec = planText.match(/Execution Time:\s*([\d.]+)\s*ms/i);
  const plan = planText.match(/Planning Time:\s*([\d.]+)\s*ms/i);
  const scanTypes = [...planText.matchAll(/(Seq Scan|Index Scan|Index Only Scan|Bitmap Heap Scan|Gather|Hash Join|Nested Loop) on ([^\s]+)/g)]
    .map((m) => `${m[1]}:${m[2]}`);
  return {
    planningMs: plan ? Number(plan[1]) : null,
    execMs: exec ? Number(exec[1]) : null,
    scans: [...new Set(scanTypes)].slice(0, 6),
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, prepare: false });

  const outDir = path.resolve(process.cwd(), "docs/perf");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "baseline.md");

  const sections: string[] = [
    `# Performance Baseline`,
    ``,
    `Generated: ${new Date().toISOString()} — EXPLAIN ${ANALYZE ? "(ANALYZE, BUFFERS)" : "plan-only"}`,
    `Dataset: see table counts below. Synthetic rows tagged datasource='PERF_SEED'.`,
    ``,
  ];

  const counts = await sql`
    SELECT (SELECT COUNT(*) FROM public.tbl_alumni) AS alumni,
           (SELECT COUNT(*) FROM public.tblcard) AS cards,
           (SELECT COUNT(*) FROM public.alumni_scholarships) AS scholarships,
           (SELECT COUNT(*) FROM public.alumni_memberships) AS memberships`;
  sections.push("## Table counts", "", "```json", JSON.stringify(counts[0], null, 2), "```", "");

  for (const q of QUERIES) {
    const prefix = ANALYZE ? "EXPLAIN (ANALYZE, BUFFERS) " : "EXPLAIN ";
    process.stdout.write(`explaining ${q.name}... `);
    const t0 = performance.now();
    let planRows: { "QUERY PLAN": string }[];
    try {
      planRows = await sql.unsafe(prefix + q.sql) as never;
    } catch (e) {
      console.log(`FAILED: ${(e as Error).message}`);
      sections.push(`## ${q.name} — ${q.source}`, "", `**FAILED:** ${(e as Error).message}`, "", "```sql", q.sql, "```", "");
      continue;
    }
    const wall = performance.now() - t0;
    const planText = planRows.map((r) => r["QUERY PLAN"]).join("\n");
    const summary = extractSummary(planText);
    console.log(`${summary.execMs ?? wall.toFixed(0)} ms`);
    sections.push(
      `## ${q.name} — ${q.source}`,
      "",
      `- execution: **${summary.execMs ?? "n/a"} ms** · planning: ${summary.planningMs ?? "n/a"} ms · wall: ${wall.toFixed(0)} ms`,
      `- scan nodes: ${summary.scans.join(", ") || "n/a"}`,
      "",
      "```",
      planText,
      "```",
      ""
    );
  }

  fs.writeFileSync(outFile, sections.join("\n"), "utf8");
  console.log(`\nWrote ${outFile}`);
  await sql.end();
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
