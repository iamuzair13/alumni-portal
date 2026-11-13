/**
 * Revert the T0.2 performance seed (branch fix/t0.2-perf-baseline → scripts/seed-perf-data.ts).
 *
 * The seed tagged every synthetic row with:
 *   datasource = 'PERF_SEED', sapid = 'PERF######', registrationno = 'PERF-######',
 *   personalemail/universityemail/alumniemail = 'perf*@seed.invalid' / '@students.uol.edu.pk'
 *
 * Usage:
 *   npx tsx scripts/cleanup-perf-seed.ts           # DRY RUN — report + sanity checks only
 *   npx tsx scripts/cleanup-perf-seed.ts --apply   # delete seed rows in a transaction
 *
 * Safety: --apply refuses to run if any sanity check fails (marker mismatch,
 * real rows matching PERF patterns, or child-table rows referencing seed alumniids).
 * The delete runs inside a transaction — FK RESTRICT/NO ACTION violations roll it back.
 */
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

type FkRef = { table_name: string; column_name: string };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, connect_timeout: 15 });

  console.log(APPLY ? "MODE: --apply (will DELETE)" : "MODE: dry-run (read-only)");

  // ---------- 1. Marker counts ----------
  const [counts] = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE datasource = 'PERF_SEED')::int AS by_datasource,
      COUNT(*) FILTER (WHERE sapid LIKE 'PERF%')::int AS by_sapid,
      COUNT(*) FILTER (WHERE registrationno LIKE 'PERF-%')::int AS by_regno,
      COUNT(*) FILTER (WHERE personalemail LIKE 'perf%@seed.invalid')::int AS by_email
    FROM public.tbl_alumni`;
  console.log("\ntbl_alumni totals:", JSON.stringify(counts, null, 2));

  const problems: string[] = [];

  // ---------- 2. Marker-consistency sanity checks ----------
  // (a) seed rows missing any of the other markers → marker drift
  const [drift] = await sql`
    SELECT COUNT(*)::int AS n FROM public.tbl_alumni
    WHERE datasource = 'PERF_SEED'
      AND (sapid NOT LIKE 'PERF%' OR registrationno NOT LIKE 'PERF-%' OR personalemail NOT LIKE 'perf%@seed.invalid')`;
  if (drift.n > 0) problems.push(`${drift.n} PERF_SEED rows are missing other PERF markers — markers drifted, inspect manually`);

  // (b) REAL rows that accidentally match a seed pattern → would be collateral damage
  const [realCollision] = await sql`
    SELECT COUNT(*)::int AS n FROM public.tbl_alumni
    WHERE datasource IS DISTINCT FROM 'PERF_SEED'
      AND (sapid LIKE 'PERF%' OR registrationno LIKE 'PERF-%' OR personalemail LIKE 'perf%@seed.invalid')`;
  if (realCollision.n > 0) problems.push(`${realCollision.n} NON-seed rows match PERF patterns — deleting on sapid/regno would hit real alumni`);

  // (c) datasource is the deletion key — it must equal the union of all marker counts
  const markerSet = new Set([counts.by_sapid, counts.by_regno, counts.by_email]);
  if (markerSet.size > 1 || !markerSet.has(counts.by_datasource)) {
    problems.push(`Marker counts disagree (datasource=${counts.by_datasource}, sapid=${counts.by_sapid}, regno=${counts.by_regno}, email=${counts.by_email}) — markers are not one consistent set`);
  }

  // ---------- 3. FK references (discovered dynamically) ----------
  const fks = await sql<FkRef[]>`
    SELECT kcu.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'tbl_alumni' AND ccu.column_name = 'alumniid'`;
  console.log(`\nFK references into tbl_alumni.alumniid (${fks.length}):`);
  for (const fk of fks) {
    const [r] = await sql.unsafe(
      `SELECT COUNT(*)::int AS n FROM public."${fk.table_name}" c JOIN public.tbl_alumni a ON c."${fk.column_name}" = a.alumniid WHERE a.datasource = 'PERF_SEED'`
    );
    console.log(`  ${fk.table_name}.${fk.column_name}: ${r.n}`);
    if (r.n > 0) problems.push(`${r.n} rows in ${fk.table_name}.${fk.column_name} reference seed alumniids — inspect before deleting`);
  }

  if (counts.by_datasource === 0) {
    console.log("\nNothing to do — no PERF_SEED rows exist.");
    await sql.end();
    return;
  }

  // ---------- 4. Decide ----------
  if (problems.length > 0) {
    console.log("\nSANITY CHECKS FAILED — refusing to delete:");
    for (const p of problems) console.log(`  - ${p}`);
    await sql.end();
    process.exit(2);
  }
  console.log("\nSanity checks passed.");

  if (!APPLY) {
    console.log(`\nDry-run complete. Would DELETE ${counts.by_datasource} rows (total ${counts.total} → ${counts.total - counts.by_datasource}).`);
    console.log("Re-run with --apply to execute.");
    await sql.end();
    return;
  }

  // ---------- 5. Delete in transaction + sequence reset ----------
  await sql.begin(async (tx) => {
    const del = await tx`DELETE FROM public.tbl_alumni WHERE datasource = 'PERF_SEED'`;
    console.log(`\nDeleted ${del.count} seed rows`);
    if (Number(del.count) !== counts.by_datasource) {
      throw new Error(`Expected to delete ${counts.by_datasource} but deleted ${del.count} — rolling back`);
    }

    const [left] = await tx`SELECT COUNT(*)::int AS n FROM public.tbl_alumni WHERE datasource = 'PERF_SEED'`;
    if (left.n !== 0) throw new Error(`${left.n} seed rows remain after delete — rolling back`);

    // Reset the alumniid sequence so new rows continue from the real max
    // (same pattern as scripts/fix-alumni-sequence.sql)
    const [seq] = await tx`
      SELECT setval(
        pg_get_serial_sequence('public.tbl_alumni', 'alumniid'),
        COALESCE((SELECT MAX(alumniid) FROM public.tbl_alumni), 0) + 1,
        false
      ) AS seq`;
    console.log(`Sequence reset → next alumniid = ${seq.seq}`);
  });

  const [after] = await sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE datasource = 'PERF_SEED')::int AS seed FROM public.tbl_alumni`;
  console.log("\nPost-cleanup:", JSON.stringify(after));
  await sql.end();
}

main().catch((e) => {
  console.error("FAILED (no changes committed):", e.message);
  process.exit(1);
});
