import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  // Check ALL constraints on tblcard
  const allConstraints = await sql`
    SELECT
      con.conname as constraint_name,
      con.contype as constraint_type,
      con.confdeltype as delete_rule,
      a.attname as column_name,
      af.attname as foreign_column,
      cl.relname as foreign_table
    FROM pg_constraint con
    JOIN pg_class cl ON con.confrelid = cl.oid
    JOIN pg_namespace ns ON con.connamespace = ns.oid
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    LEFT JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
    WHERE con.conrelid = 'public.tblcard'::regclass
    ORDER BY con.contype
  `;
  console.log("=== ALL constraints on tblcard (pg_constraint) ===");
  for (const c of allConstraints) {
    const delRule = c.delete_rule === 'a' ? 'NO ACTION' :
                    c.delete_rule === 'c' ? 'CASCADE' :
                    c.delete_rule === 'r' ? 'RESTRICT' :
                    c.delete_rule === 'n' ? 'SET NULL' :
                    c.delete_rule === 'd' ? 'SET DEFAULT' : c.delete_rule;
    const conType = c.constraint_type === 'p' ? 'PRIMARY KEY' :
                    c.constraint_type === 'f' ? 'FOREIGN KEY' :
                    c.constraint_type === 'u' ? 'UNIQUE' :
                    c.constraint_type === 'c' ? 'CHECK' : c.constraint_type;
    console.log(`  ${conType}: ${c.constraint_name}`);
    console.log(`    column: ${c.column_name} → ${c.foreign_table}.${c.foreign_column}`);
    console.log(`    ON DELETE: ${delRule}`);
    console.log();
  }

  // Also check if there's a CASCADE on tblcard specifically
  const cardFk = await sql`
    SELECT
      con.conname,
      con.confdeltype,
      con.contype
    FROM pg_constraint con
    WHERE con.conrelid = 'public.tblcard'::regclass
      AND con.contype = 'f'
  `;
  console.log(`=== tblcard FK constraints count: ${cardFk.length} ===`);
  for (const f of cardFk) {
    const delRule = f.confdeltype === 'a' ? 'NO ACTION' :
                    f.confdeltype === 'c' ? 'CASCADE' :
                    f.confdeltype === 'r' ? 'RESTRICT' :
                    f.confdeltype === 'n' ? 'SET NULL' :
                    f.confdeltype === 'd' ? 'SET DEFAULT' : f.confdeltype;
    console.log(`  ${f.conname}: ON DELETE ${delRule}`);
  }

  await sql.end();
})();
