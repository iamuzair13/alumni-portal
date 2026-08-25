import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  const f = await sql`
    SELECT id, faculty_name FROM public.tbl_faculties
    WHERE faculty_name ILIKE '%arts%' OR faculty_name ILIKE '%architecture%'
  `;
  console.log("Faculties matching arts/architecture:");
  for (const r of f) console.log(`  [${r.id}] "${r.faculty_name}"`);

  const d = await sql`
    SELECT id, department_name FROM public.tbl_departments
    WHERE department_name ILIKE '%molecular%' OR department_name ILIKE '%medicin%'
  `;
  console.log("\nDepartments matching molecular/medicin:");
  for (const r of d) console.log(`  [${r.id}] "${r.department_name}"`);

  await sql.end();
})();
