import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";
import { generateEasyPassword } from "../src/lib/passwordUtils";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  // Check how many under-approval records have empty/null passwords
  const before = await sql`
    SELECT
      COUNT(*) FILTER (WHERE password IS NULL OR TRIM(password) = '') as empty_password,
      COUNT(*) FILTER (WHERE password IS NOT NULL AND TRIM(password) != '') as has_password,
      COUNT(*) as total
    FROM public.tbl_alumni
    WHERE verify = 'underApproval'
  `;
  console.log("=== BEFORE: Password status for verify='underApproval' ===");
  console.log(`  Total under-approval records: ${before[0].total}`);
  console.log(`  With empty/null password: ${before[0].empty_password}`);
  console.log(`  With existing password: ${before[0].has_password}`);

  const toUpdate = Number(before[0].empty_password);
  if (toUpdate === 0) {
    console.log("\n✅ All under-approval records already have passwords. Nothing to do.");
    await sql.end();
    return;
  }

  console.log(`\n🔄 Generating ${toUpdate} random passwords using generateEasyPassword()...`);
  console.log(`   Format: 3-4 lowercase letters + 3-4 digits (e.g. "abc1234")\n`);

  // Fetch all records that need passwords
  const records = await sql`
    SELECT alumniid, sapid, alumniname
    FROM public.tbl_alumni
    WHERE verify = 'underApproval'
      AND (password IS NULL OR TRIM(password) = '')
    ORDER BY alumniid
  ` as Array<{ alumniid: number; sapid: string | null; alumniname: string | null }>;

  console.log(`   Fetched ${records.length} records to update\n`);

  // Generate a unique password for each record and update in batches
  const BATCH_SIZE = 100;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    const startTime = Date.now();

    try {
      await sql.begin(async (tx) => {
        for (const r of batch) {
          const password = generateEasyPassword();
          try {
            await tx`
              UPDATE public.tbl_alumni
              SET password = ${password}
              WHERE alumniid = ${r.alumniid}
            `;
            updated++;
          } catch (err: any) {
            failed++;
            errors.push(`alumniid=${r.alumniid} sapid=${r.sapid}: ${err.message}`);
          }
        }
      });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`  ✅ Batch ${batchNum}/${totalBatches}: updated ${batch.length} records (${elapsed}s)`);
    } catch (txErr: any) {
      failed += batch.length;
      errors.push(`Batch ${batchNum} transaction failed: ${txErr.message}`);
      console.log(`  ❌ Batch ${batchNum}/${totalBatches} failed: ${txErr.message}`);
    }

    if (i + BATCH_SIZE < records.length) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // Verify
  const after = await sql`
    SELECT
      COUNT(*) FILTER (WHERE password IS NULL OR TRIM(password) = '') as empty_password,
      COUNT(*) FILTER (WHERE password IS NOT NULL AND TRIM(password) != '') as has_password,
      COUNT(*) as total
    FROM public.tbl_alumni
    WHERE verify = 'underApproval'
  `;
  console.log("\n=== AFTER: Password status for verify='underApproval' ===");
  console.log(`  Total under-approval records: ${after[0].total}`);
  console.log(`  With empty/null password: ${after[0].empty_password}`);
  console.log(`  With existing password: ${after[0].has_password}`);

  // Show a few sample passwords (first 5 only, for verification)
  const samples = await sql`
    SELECT alumniid, sapid, alumniname, password
    FROM public.tbl_alumni
    WHERE verify = 'underApproval'
      AND password IS NOT NULL AND TRIM(password) != ''
    ORDER BY alumniid
    LIMIT 5
  `;
  console.log("\n=== Sample generated passwords (first 5) ===");
  for (const s of samples) {
    console.log(`  alumniid=${s.alumniid} sapid=${s.sapid} name="${s.alumniname}" → password="${s.password}"`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 PASSWORD GENERATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    errors.slice(0, 10).forEach((e, idx) => console.log(`   ${idx + 1}. ${e}`));
  }

  await sql.end();
  process.exit(0);
})();
