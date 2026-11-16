import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, connect_timeout: 10 });
  const rows = await sql`
    SELECT
      (SELECT COUNT(*) FROM public.tbl_alumni) AS alumni,
      (SELECT COUNT(*) FROM public.tblcard) AS cards,
      (SELECT COUNT(*) FROM public.alumni_scholarships) AS scholarships,
      (SELECT COUNT(*) FROM public.tbl_faculties) AS faculties,
      (SELECT COUNT(*) FROM public.tbl_departments) AS departments,
      (SELECT COUNT(*) FROM public.tbl_programs) AS programs,
      (SELECT COUNT(*) FROM public.tbl_alumni WHERE datasource = 'PERF_SEED') AS seed_rows
  `;
  const ds = await sql`
    SELECT COALESCE(datasource, '<null>') AS datasource, COUNT(*)::int AS n
    FROM public.tbl_alumni GROUP BY datasource ORDER BY n DESC LIMIT 10`;
  const sap = await sql`
    SELECT COUNT(*)::int AS n FROM public.tbl_alumni WHERE sapid LIKE 'PERF%'`;
  console.log(JSON.stringify(rows[0], null, 2));
  console.log("datasource breakdown:", JSON.stringify(ds));
  console.log("sapid PERF%:", JSON.stringify(sap[0]));
  await sql.end();
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
