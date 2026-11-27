import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  try {
    const file = path.resolve(process.cwd(), "migrations/078_merchant_categories.sql");
    const text = fs.readFileSync(file, "utf8");
    await sql.unsafe(text);
    console.log("migration applied");

    const categories = await sql`
      SELECT c.id, c.name, c.slug, c.color,
             (SELECT COUNT(*) FROM public.merchant_category_map m
              WHERE m.category_id = c.id)::int AS merchant_count
      FROM public.merchant_categories c
      ORDER BY c.id
    `;
    console.table(categories);
  } catch (e) {
    console.error("ERROR:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
  }
  await sql.end();
  process.exit(0);
})();
