import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  const rows = await sql`
    SELECT conrelid::regclass::text AS table_name, conname AS constraint_name,
           pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%president%'
    ORDER BY 1, 2
  `;
  console.table(rows);
  await sql.end();
  process.exit(0);
})();
