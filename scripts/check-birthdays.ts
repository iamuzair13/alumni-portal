import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  try {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'tbl_alumni'
        AND (column_name ILIKE '%degree%' OR column_name ILIKE '%program%' OR column_name ILIKE '%year%')
      ORDER BY column_name
    `;
    console.log("degree/year cols:", cols.map((c) => c.column_name));

    const t = await sql`SELECT to_regclass('public.alumni_birthdays') AS t`;
    console.log("table:", t[0]);

    const rows = await sql`
      SELECT
        b.id, b.alumniid, b.linkedin_post_url, b.gift_image_url, b.created_at,
        a.alumniname, a.sapid, a.registrationno, a.degree_title, a.yearofending,
        a.image1, p.program_name
      FROM public.alumni_birthdays b
      INNER JOIN public.tbl_alumni a ON a.alumniid = b.alumniid
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT 5
    `;
    console.log("query ok, rows:", rows.length);

    // simulate lookup with a real sapid that has chapters
    const sample = await sql`
      SELECT a.alumniid, a.sapid, a.degree_title, ac.chapter1, ac.chapter2, ac.chapter3,
        COALESCE(assoc.faculty_name, f.faculty_name) AS association_title
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      WHERE ac.chapter1 IS NOT NULL
      LIMIT 1
    `;
    console.log("sample alumni with chapter:", sample[0]);

    const chapterIds = [sample[0]?.chapter1, sample[0]?.chapter2, sample[0]?.chapter3]
      .filter((v) => v != null)
      .map(Number);
    if (chapterIds.length) {
      const ch = await sql`
        SELECT chapterid, chaptertitle
        FROM public.alumnichapterslocation
        WHERE chapterid = ANY(${chapterIds}::int[])
      `;
      console.log("chapters resolved:", ch);
    }

    // full lookup query shape
    const lu = await sql`
      SELECT a.alumniid, a.alumniname, a.sapid, a.registrationno, a.degree_title,
        a.yearofending, a.image1, p.program_name,
        COALESCE(assoc.faculty_name, f.faculty_name) AS association_title,
        ac.chapter1, ac.chapter2, ac.chapter3
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      WHERE a.sapid = ${String(sample[0]?.sapid ?? "")}
      LIMIT 1
    `;
    console.log("lookup shape ok:", lu.length === 1);
  } catch (e) {
    console.error("ERROR:", e instanceof Error ? e.message : e);
  }
  await sql.end();
  process.exit(0);
})();
