/**
 * Generate passwords for ALL alumni records that have empty or NULL passwords,
 * regardless of verify status (underApproval, true, false, null).
 *
 * Usage:
 *   npx tsx scripts/generate-passwords-empty.ts           # generate for all empty
 *   npx tsx scripts/generate-passwords-empty.ts --dry-run # preview only, no changes
 *
 * Related script:
 *   scripts/generate-passwords-under-approval.ts  (only covers verify='underApproval')
 */

import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";
import { generateEasyPassword } from "../src/lib/passwordUtils";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const isDryRun = process.argv.includes("--dry-run");

(async () => {
  console.log("=".repeat(60));
  console.log("🔑 PASSWORD GENERATION — Empty/NULL passwords (all verify statuses)");
  console.log("=".repeat(60));
  if (isDryRun) {
    console.log("⚠️  DRY RUN MODE — no changes will be made\n");
  }

  // ─── BEFORE: count empty passwords grouped by verify status ───
  const before = await sql`
    SELECT
      COALESCE(verify, '(null)') as verify_status,
      COUNT(*) FILTER (WHERE password IS NULL OR TRIM(password) = '') as empty_password,
      COUNT(*) FILTER (WHERE password IS NOT NULL AND TRIM(password) != '') as has_password,
      COUNT(*) as total
    FROM public.tbl_alumni
    GROUP BY verify
    ORDER BY verify
  `;

  console.log("=== BEFORE: Password status by verify status ===");
  for (const row of before) {
    console.log(
      `  verify='${row.verify_status}'  total=${row.total}  empty=${row.empty_password}  has=${row.has_password}`
    );
  }

  // ─── Count total records needing passwords ───
  const totalEmpty = await sql`
    SELECT COUNT(*) as count
    FROM public.tbl_alumni
    WHERE password IS NULL OR TRIM(password) = ''
  `;
  const toUpdate = Number(totalEmpty[0].count);

  if (toUpdate === 0) {
    console.log("\n✅ All alumni records already have passwords. Nothing to do.");
    await sql.end();
    return;
  }

  console.log(`\n📊 Total records with empty/null password: ${toUpdate}`);
  console.log(`   Format: 3-4 lowercase letters + 3-4 digits (e.g. "abc1234")\n`);

  if (isDryRun) {
    // Show a sample of records that would be updated
    const sample = await sql`
      SELECT alumniid, sapid, alumniname, verify
      FROM public.tbl_alumni
      WHERE password IS NULL OR TRIM(password) = ''
      ORDER BY alumniid
      LIMIT 10
    `;
    console.log("=== Sample records that would be updated (first 10) ===");
    for (const s of sample) {
      console.log(
        `  alumniid=${s.alumniid}  sapid=${s.sapid ?? "-"}  name="${s.alumniname ?? "-"}"  verify='${s.verify ?? "(null)"}'`
      );
    }
    console.log(`\n⚠️  Dry run complete. ${toUpdate} records would be updated.`);
    await sql.end();
    return;
  }

  // ─── Fetch all records needing passwords ───
  const records = (await sql`
    SELECT alumniid, sapid, alumniname, verify
    FROM public.tbl_alumni
    WHERE password IS NULL OR TRIM(password) = ''
    ORDER BY alumniid
  `) as Array<{ alumniid: number; sapid: string | null; alumniname: string | null; verify: string | null }>;

  console.log(`   Fetched ${records.length} records to update\n`);

  // ─── Generate and update passwords one by one ───
  // Individual updates (not batch transactions) so a single failure doesn't
  // poison the rest — same pattern as the bulk-upload import fix.
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];
  const BATCH_LOG = 100; // log progress every 100 records

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const password = generateEasyPassword();
    try {
      await sql`
        UPDATE public.tbl_alumni
        SET password = ${password}
        WHERE alumniid = ${r.alumniid}
      `;
      updated++;
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`alumniid=${r.alumniid} sapid=${r.sapid}: ${msg}`);
    }

    if ((i + 1) % BATCH_LOG === 0) {
      console.log(`  ...processed ${i + 1}/${records.length} (updated=${updated}, failed=${failed})`);
    }
  }

  // ─── AFTER: verify ───
  const after = await sql`
    SELECT
      COALESCE(verify, '(null)') as verify_status,
      COUNT(*) FILTER (WHERE password IS NULL OR TRIM(password) = '') as empty_password,
      COUNT(*) FILTER (WHERE password IS NOT NULL AND TRIM(password) != '') as has_password,
      COUNT(*) as total
    FROM public.tbl_alumni
    GROUP BY verify
    ORDER BY verify
  `;

  console.log("\n=== AFTER: Password status by verify status ===");
  for (const row of after) {
    console.log(
      `  verify='${row.verify_status}'  total=${row.total}  empty=${row.empty_password}  has=${row.has_password}`
    );
  }

  // ─── Summary ───
  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 PASSWORD GENERATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Failed:  ${failed}`);
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (first 10):`);
    errors.slice(0, 10).forEach((e, idx) => console.log(`   ${idx + 1}. ${e}`));
  }

  await sql.end();
  process.exit(0);
})();
