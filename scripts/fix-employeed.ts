import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  // Before
  const before = await sql`
    SELECT employeed, COUNT(*) as cnt
    FROM public.tbl_alumni
    WHERE verify = 'underApproval'
    GROUP BY employeed
    ORDER BY cnt DESC
  `;
  console.log("=== BEFORE: employeed values for verify='underApproval' ===");
  for (const r of before) console.log(`  [${r.cnt}] "${r.employeed}"`);

  // Update: "Unemployed" → "Unemployed(Searching for job)" (exact Excel entry)
  const result = await sql`
    UPDATE public.tbl_alumni
    SET employeed = 'Unemployed(Searching for job)'
    WHERE verify = 'underApproval' AND employeed = 'Unemployed'
  `;
  console.log(`\n✅ Updated ${result.count} records: "Unemployed" → "Unemployed(Searching for job)"`);

  // After
  const after = await sql`
    SELECT employeed, COUNT(*) as cnt
    FROM public.tbl_alumni
    WHERE verify = 'underApproval'
    GROUP BY employeed
    ORDER BY cnt DESC
  `;
  console.log("\n=== AFTER: employeed values for verify='underApproval' ===");
  for (const r of after) console.log(`  [${r.cnt}] "${r.employeed}"`);

  await sql.end();
})();
