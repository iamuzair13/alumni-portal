import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  try {
    const file = path.resolve(process.cwd(), "migrations/076_leadership_new_positions.sql");
    const text = fs.readFileSync(file, "utf8");
    await sql.unsafe(text);
    console.log("migration applied");

    const roles = await sql`
      SELECT leadership_type, role_name
      FROM public.leadership_roles
      ORDER BY leadership_type, role_name
    `;
    console.table(roles);
  } catch (e) {
    console.error("ERROR:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
  }
  await sql.end();
  process.exit(0);
})();
