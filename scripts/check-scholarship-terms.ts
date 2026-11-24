import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const SAPIDS = [
  "70129868", "70106014", "70126562", "70102600", "70108600",
  "70107124", "70110458", "70120326", "70081549", "70110522",
];

(async () => {
  try {
    const rows = await sql`
      SELECT
        a.sapid,
        a.alumniid,
        a.alumniname,
        s.id           AS scholarship_id,
        s.application_term,
        s.application_year,
        s.status,
        s.apply_for,
        s.created_at
      FROM public.tbl_alumni a
      LEFT JOIN public.alumni_scholarships s ON s.id = a.alumniid
      WHERE a.sapid = ANY(${SAPIDS})
      ORDER BY a.sapid
    `;
    console.table(rows);

    const missing = await sql`
      SELECT a.sapid FROM public.tbl_alumni a
      WHERE a.sapid = ANY(${SAPIDS}) AND NOT EXISTS (
        SELECT 1 FROM public.alumni_scholarships s WHERE s.id = a.alumniid
      )
    `;
    console.log("no scholarship row:", missing.map((r) => r.sapid));

    const noMatch = await sql`
      SELECT t.sapid FROM unnest(${SAPIDS}::text[]) t(sapid)
      WHERE NOT EXISTS (SELECT 1 FROM public.tbl_alumni a WHERE a.sapid = t.sapid)
    `;
    console.log("sapid not found:", noMatch.map((r) => r.sapid));

    const terms = await sql`
      SELECT DISTINCT application_term FROM public.alumni_scholarships
    `;
    console.log("distinct terms in table:", terms.map((r) => r.application_term));
  } catch (e) {
    console.error("ERROR:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
  }
  await sql.end();
  process.exit(0);
})();
