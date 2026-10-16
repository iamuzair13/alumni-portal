import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'alumni_scholarships'
      AND column_name = 'discount_terms_accepted'
  `;
  console.log(cols);
  if (cols.length === 0) {
    console.error("❌ discount_terms_accepted column is MISSING");
    process.exit(1);
  }
  console.log("✅ discount_terms_accepted column exists");
  await sql.end();
  process.exit(0);
})();
