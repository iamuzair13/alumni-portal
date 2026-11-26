import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  try {
    const file = path.resolve(process.cwd(), "migrations/077_leadership_recommendations_role_check.sql");
    const text = fs.readFileSync(file, "utf8");
    await sql.unsafe(text);
    console.log("migration applied");

    const constraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'public.leadership_recommendations'::regclass
        AND contype = 'c'
    `;
    console.table(constraints);
  } catch (e) {
    console.error("ERROR:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
  }
  await sql.end();
  process.exit(0);
})();
