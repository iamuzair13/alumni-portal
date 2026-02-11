import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type CsvRow = {
  registrationNo: string;
  sapId: string;
  line: number;
};

type DbRow = {
  alumniid: number;
  registrationno: string | null;
  sapid: string | null;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeRegNo(v: string): string {
  // Keep as-is except trim consecutive spaces
  return clean(v).replace(/\s+/g, " ");
}

function regNoKey(v: string): string {
  return normalizeRegNo(v)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeSapId(v: string): string {
  return clean(v);
}

function isMissingSapId(v: string): boolean {
  const s = normalizeSapId(v);
  if (!s) return true;
  if (s.toLowerCase() === "#n/a") return true;
  if (s.toLowerCase() === "na") return true;
  return false;
}

function resolveCsvPath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;
  if (fs.existsSync(inputPath)) return path.resolve(inputPath);
  if (fs.existsSync(path.join(process.cwd(), inputPath))) return path.resolve(process.cwd(), inputPath);
  if (fs.existsSync(path.join(process.cwd(), "scripts", inputPath))) return path.resolve(process.cwd(), "scripts", inputPath);
  return path.resolve(process.cwd(), inputPath);
}

function readCsvRows(filePath: string): {
  rows: CsvRow[];
  skipped: { missingReg: number; missingSap: number };
  conflicts: Array<{ registrationNo: string; sapIds: string[]; lines: number[] }>;
} {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const headerLine = lines[0];
  if (!headerLine) throw new Error("CSV header missing");

  const header = parseCsvLine(headerLine).map((h) => clean(h));
  const regIdx = header.findIndex((h) => h.toLowerCase() === "registration no" || h.toLowerCase() === "registrationno");
  if (regIdx < 0) throw new Error("Could not find 'Registration No' column in CSV header");

  const sapIndices = header
    .map((h, idx) => ({ h: h.toLowerCase(), idx }))
    .filter((x) => x.h === "sap id" || x.h === "sapid");
  if (sapIndices.length === 0) throw new Error("Could not find 'SAP ID' column in CSV header");

  // In this CSV there are two SAP ID columns. We want the one that sits next to Registration No,
  // which is the first SAP ID column after the Registration No column.
  const sapIdx = sapIndices.find((x) => x.idx > regIdx)?.idx ?? sapIndices[sapIndices.length - 1]!.idx;

  const seen = new Map<string, { sapId: string; line: number }[]>();
  const rows: CsvRow[] = [];
  let missingReg = 0;
  let missingSap = 0;

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const cols = parseCsvLine(raw);

    const reg = normalizeRegNo(cols[regIdx] ?? "");
    const sap = normalizeSapId(cols[sapIdx] ?? "");

    if (!reg) {
      missingReg++;
      continue;
    }
    if (isMissingSapId(sap)) {
      missingSap++;
      continue;
    }

    const entry: CsvRow = { registrationNo: reg, sapId: sap, line: i + 1 };
    rows.push(entry);

    const list = seen.get(reg) ?? [];
    list.push({ sapId: sap, line: i + 1 });
    seen.set(reg, list);
  }

  const conflicts: Array<{ registrationNo: string; sapIds: string[]; lines: number[] }> = [];
  const deduped: CsvRow[] = [];

  for (const [reg, list] of seen.entries()) {
    const uniqueSap = Array.from(new Set(list.map((x) => x.sapId)));
    if (uniqueSap.length > 1) {
      conflicts.push({ registrationNo: reg, sapIds: uniqueSap, lines: list.map((x) => x.line) });
      continue;
    }
    const first = list[0]!;
    deduped.push({ registrationNo: reg, sapId: first.sapId, line: first.line });
  }

  return {
    rows: deduped,
    skipped: { missingReg, missingSap },
    conflicts,
  };
}

function toPgTextArrayLiteral(values: string[]): string {
  // Used only for SELECT ... WHERE registrationno = ANY(...)
  // Escape single quotes safely.
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`);
  return `ARRAY[${escaped.join(", ")}]::text[]`;
}

function describeDatabaseUrl(databaseUrl: string): string {
  try {
    const u = new URL(databaseUrl);
    const host = u.hostname;
    const port = u.port || "5432";
    const database = u.pathname?.replace(/^\//, "") || "";
    const username = decodeURIComponent(u.username || "");
    return `host=${host} port=${port} db=${database} user=${username}`;
  } catch {
    return "(unable to parse DATABASE_URL)";
  }
}

async function main() {
  const csvArg = process.argv.find((a) => a.startsWith("--csv="));
  const apply = process.argv.includes("--apply");
  const outMissingArg = process.argv.find((a) => a.startsWith("--out-missing="));

  if (!csvArg) {
    console.error("Usage: tsx scripts/update-sapids-from-csv.ts --csv=\"<path>\" [--apply]");
    process.exit(1);
  }

  const csvPathInput = csvArg.slice("--csv=".length).replace(/^"|"$/g, "");
  const csvPath = resolveCsvPath(csvPathInput);

  const outMissingPathInput = outMissingArg
    ? outMissingArg.slice("--out-missing=".length).replace(/^"|"$/g, "")
    : path.resolve(process.cwd(), "scripts", "missing-registrationnos.csv");
  const outMissingPath = path.isAbsolute(outMissingPathInput)
    ? outMissingPathInput
    : path.resolve(process.cwd(), outMissingPathInput);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is not set");
    console.error("Please set DATABASE_URL in your .env.local file");
    process.exit(1);
  }

  console.log(`DB target: ${describeDatabaseUrl(process.env.DATABASE_URL)}`);

  const sql = postgres(process.env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });

  const { rows: csvRows, skipped, conflicts } = readCsvRows(csvPath);

  console.log("\n==== CSV SANITY CHECK ====");
  console.log(`CSV file: ${csvPath}`);
  console.log(`Parsed valid pairs (deduped): ${csvRows.length}`);
  console.log(`Skipped rows (missing Registration No): ${skipped.missingReg}`);
  console.log(`Skipped rows (missing/invalid SAP ID): ${skipped.missingSap}`);
  console.log(`Conflicting Registration Nos in CSV (blocked): ${conflicts.length}`);

  if (conflicts.length > 0) {
    console.log("\nConflicts (same registration no with different sapids):");
    for (const c of conflicts.slice(0, 20)) {
      console.log(`- ${c.registrationNo}: ${c.sapIds.join(" | ")} (lines: ${c.lines.join(", ")})`);
    }
    if (conflicts.length > 20) console.log(`... plus ${conflicts.length - 20} more conflicts`);
  }

  // Additional uniqueness check: one SAP ID should not map to multiple registration numbers.
  const sapToRegs = new Map<string, Set<string>>();
  for (const r of csvRows) {
    const set = sapToRegs.get(r.sapId) ?? new Set<string>();
    set.add(r.registrationNo);
    sapToRegs.set(r.sapId, set);
  }
  const sapConflicts = Array.from(sapToRegs.entries()).filter(([, regs]) => regs.size > 1);
  console.log(`SAP IDs mapped to multiple registration numbers (blocked): ${sapConflicts.length}`);
  if (sapConflicts.length > 0) {
    for (const [sap, regs] of sapConflicts.slice(0, 20)) {
      console.log(`- SAPID ${sap} => ${Array.from(regs).join(", ")}`);
    }
    if (sapConflicts.length > 20) console.log(`... plus ${sapConflicts.length - 20} more`);
  }

  // Build the final eligible list (exclude conflicts)
  const blockedRegs = new Set(conflicts.map((c) => c.registrationNo));
  const blockedSap = new Set(sapConflicts.map(([sap]) => sap));
  const eligible = csvRows.filter((r) => !blockedRegs.has(r.registrationNo) && !blockedSap.has(r.sapId));

  console.log("\n==== DB PREVIEW (READ-ONLY) ====");
  console.log(`Eligible pairs after blocking conflicts: ${eligible.length}`);

  const regNos = eligible.map((r) => r.registrationNo);
  if (regNos.length === 0) {
    console.log("Nothing eligible to update.");
    await sql.end({ timeout: 5 });
    return;
  }

  // Pull matching rows from DB
  const exactArrayLiteral = toPgTextArrayLiteral(regNos);

  const keys = Array.from(new Set(regNos.map((r) => regNoKey(r)).filter(Boolean)));
  const keyArrayLiteral = toPgTextArrayLiteral(keys);

  const dbRows = (await sql.unsafe(`
    SELECT alumniid, registrationno, sapid
    FROM public.tbl_alumni
    WHERE registrationno = ANY(${exactArrayLiteral})
       OR regexp_replace(upper(coalesce(registrationno, '')), '[^A-Z0-9]', '', 'g') = ANY(${keyArrayLiteral})
  `)) as unknown as DbRow[];

  const dbByExact = new Map<string, DbRow>();
  const dbByKey = new Map<string, DbRow[]>();
  for (const r of dbRows) {
    const reg = normalizeRegNo(String(r.registrationno ?? ""));
    if (reg) dbByExact.set(reg, r);

    const k = regNoKey(String(r.registrationno ?? ""));
    if (k) {
      const list = dbByKey.get(k) ?? [];
      list.push(r);
      dbByKey.set(k, list);
    }
  }

  let notFound = 0;
  let alreadyHasSame = 0;
  let wouldOverwriteDifferent = 0;
  let wouldSet = 0;
  let matchedByExact = 0;
  let matchedByNormalized = 0;
  let ambiguousNormalized = 0;

  const toUpdate: Array<{ registrationNo: string; sapId: string; alumniid: number }> = [];
  const overwriteExamples: Array<{ registrationNo: string; csvSapId: string; dbSapId: string | null }> = [];
  const notFoundExamples: Array<{ registrationNo: string; sapId: string }> = [];
  const missingRows: Array<{ registrationNo: string; sapId: string; line: number; reason: string }> = [];

  for (const r of eligible) {
    const exact = dbByExact.get(r.registrationNo);
    let db: DbRow | undefined = exact;
    if (db) {
      matchedByExact++;
    } else {
      const k = regNoKey(r.registrationNo);
      const candidates = k ? dbByKey.get(k) : undefined;
      if (candidates && candidates.length === 1) {
        db = candidates[0];
        matchedByNormalized++;
      } else if (candidates && candidates.length > 1) {
        ambiguousNormalized++;
        missingRows.push({
          registrationNo: r.registrationNo,
          sapId: r.sapId,
          line: r.line,
          reason: "ambiguous_normalized_match",
        });
      }
    }

    if (!db) {
      notFound++;
      if (notFoundExamples.length < 20) notFoundExamples.push({ registrationNo: r.registrationNo, sapId: r.sapId });
      missingRows.push({
        registrationNo: r.registrationNo,
        sapId: r.sapId,
        line: r.line,
        reason: "not_found",
      });
      continue;
    }

    const dbReg = normalizeRegNo(String(db.registrationno ?? ""));
    const currentSap = clean(db.sapid);
    if (!currentSap) {
      wouldSet++;
      toUpdate.push({ registrationNo: dbReg || r.registrationNo, sapId: r.sapId, alumniid: db.alumniid });
      continue;
    }

    if (currentSap === r.sapId) {
      alreadyHasSame++;
      continue;
    }

    wouldOverwriteDifferent++;
    if (overwriteExamples.length < 20) overwriteExamples.push({ registrationNo: r.registrationNo, csvSapId: r.sapId, dbSapId: db.sapid });
  }

  console.log(`DB rows loaded for matching: ${dbRows.length}`);
  console.log(`Matched by exact registrationno: ${matchedByExact}`);
  console.log(`Matched by normalized registrationno key: ${matchedByNormalized}`);
  console.log(`Ambiguous normalized matches (blocked): ${ambiguousNormalized}`);
  console.log(`Registration Nos not found in DB: ${notFound}`);
  console.log(`Already has same SAPID in DB (no-op): ${alreadyHasSame}`);
  console.log(`Would overwrite existing SAPID with different value (BLOCKED): ${wouldOverwriteDifferent}`);
  console.log(`Would set SAPID (safe updates): ${wouldSet}`);

  if (missingRows.length > 0) {
    const header = "registrationno,sapid,line,reason";
    const lines = missingRows.map((m) => {
      const reg = m.registrationNo.replace(/"/g, '""');
      const sap = m.sapId.replace(/"/g, '""');
      return `"${reg}","${sap}",${m.line},${m.reason}`;
    });
    fs.writeFileSync(outMissingPath, [header, ...lines].join("\n"), "utf-8");
    console.log(`\nMissing/blocked registration numbers exported to: ${outMissingPath}`);
    console.log("Showing first 50 missing/blocked:");
    for (const m of missingRows.slice(0, 50)) {
      console.log(`- [${m.reason}] line ${m.line}: ${m.registrationNo} => ${m.sapId}`);
    }
    if (missingRows.length > 50) console.log(`... plus ${missingRows.length - 50} more`);
  }

  if (notFoundExamples.length > 0) {
    console.log("\nExamples not found in DB:");
    for (const ex of notFoundExamples) console.log(`- ${ex.registrationNo} => ${ex.sapId}`);
  }

  if (overwriteExamples.length > 0) {
    console.log("\nExamples that would overwrite (blocked):");
    for (const ex of overwriteExamples) console.log(`- ${ex.registrationNo}: DB=${ex.dbSapId ?? ""} CSV=${ex.csvSapId}`);
  }

  console.log("\n==== PREVIEW SAMPLE OF SAFE UPDATES (first 25) ====");
  for (const u of toUpdate.slice(0, 25)) {
    console.log(`- alumniid=${u.alumniid} registrationno=${u.registrationNo} sapid=${u.sapId}`);
  }

  if (!apply) {
    console.log("\nDry-run complete. No database changes were made.");
    console.log("To apply ONLY the safe updates shown above, re-run with: --apply");
    await sql.end({ timeout: 5 });
    return;
  }

  if (wouldOverwriteDifferent > 0) {
    console.error("\n❌ Refusing to apply because some rows would overwrite existing sapid values.");
    console.error("Clean/resolve overwrites first, or explicitly allow overwrites in a separate controlled run (not implemented by design)." );
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  console.log("\n==== APPLYING UPDATES (TRANSACTION) ====");

  const updated = await sql.begin(async (tx) => {
    let ok = 0;
    for (const u of toUpdate) {
      const res = await tx/* sql */`
        UPDATE public.tbl_alumni
        SET sapid = ${u.sapId}
        WHERE registrationno = ${u.registrationNo}
          AND (sapid IS NULL OR TRIM(sapid) = '')
      `;
      ok += Number(res.count ?? 0);
    }
    return ok;
  });

  console.log(`Updated rows: ${updated}`);
  if (updated !== toUpdate.length) {
    console.error("❌ Mismatch: updated row count does not equal planned safe update count.");
    console.error(`Planned: ${toUpdate.length}, Updated: ${updated}`);
    console.error("No further actions taken. Investigate before re-running.");
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  // Post-check: confirm all planned rows now have correct sapid
  const postCheck = (await sql.unsafe(`
    SELECT registrationno, sapid
    FROM public.tbl_alumni
    WHERE registrationno = ANY(${exactArrayLiteral})
       OR regexp_replace(upper(coalesce(registrationno, '')), '[^A-Z0-9]', '', 'g') = ANY(${keyArrayLiteral})
  `)) as unknown as Array<{ registrationno: string; sapid: string | null }>;

  const postByReg = new Map(postCheck.map((r) => [normalizeRegNo(r.registrationno), clean(r.sapid)]));
  const mismatches: Array<{ registrationNo: string; expected: string; got: string }> = [];

  for (const u of toUpdate) {
    const got = postByReg.get(u.registrationNo) ?? "";
    if (got !== u.sapId) mismatches.push({ registrationNo: u.registrationNo, expected: u.sapId, got });
  }

  if (mismatches.length > 0) {
    console.error("\n❌ Post-check mismatches found:");
    for (const m of mismatches.slice(0, 50)) console.error(`- ${m.registrationNo}: expected=${m.expected}, got=${m.got}`);
    if (mismatches.length > 50) console.error(`... plus ${mismatches.length - 50} more`);
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  console.log("✅ Post-check passed: all updated sapids match the CSV mapping.");
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("❌ Failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
