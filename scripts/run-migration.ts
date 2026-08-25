import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  const migrationPath = process.argv[2];
  if (!migrationPath) {
    console.error("Usage: npx tsx scripts/run-migration.ts <migration.sql>");
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), migrationPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Migration file not found: ${fullPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  console.log(`Running migration: ${migrationPath}\n`);

  try {
    await sql.unsafe(content);
    console.log("✅ Migration applied successfully.\n");

    // Verify the constraint
    const result = await sql`
      SELECT con.conname, con.confdeltype
      FROM pg_constraint con
      WHERE con.conrelid = 'public.tblcard'::regclass
        AND con.contype = 'f'
    `;
    console.log("=== tblcard FK constraints after migration ===");
    for (const r of result) {
      const delRule = r.confdeltype === 'a' ? 'NO ACTION' :
                      r.confdeltype === 'c' ? 'CASCADE' :
                      r.confdeltype === 'r' ? 'RESTRICT' :
                      r.confdeltype === 'n' ? 'SET NULL' :
                      r.confdeltype === 'd' ? 'SET DEFAULT' : r.confdeltype;
      console.log(`  ${r.conname}: ON DELETE ${delRule}`);
    }
  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }

  await sql.end();
  process.exit(0);
})();
