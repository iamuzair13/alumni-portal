import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

(async () => {
  // Count orphaned cards
  const orphans = await sql`
    SELECT c.cardid, c.alumniid, c.status, c.cardpicture, c.card_image
    FROM public.tblcard c
    LEFT JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
    WHERE a.alumniid IS NULL
  `;
  console.log(`=== Orphaned cards (alumniid doesn't exist in tbl_alumni): ${orphans.length} ===`);
  for (const o of orphans) {
    console.log(`  cardid=${o.cardid} alumniid=${o.alumniid} status="${o.status}" cardpicture="${o.cardpicture}" card_image="${o.card_image}"`);
  }

  // Count valid cards
  const valid = await sql`
    SELECT COUNT(*) as cnt
    FROM public.tblcard c
    JOIN public.tbl_alumni a ON a.alumniid = c.alumniid
  `;
  console.log(`\nValid cards (alumni exists): ${valid[0].cnt}`);

  const total = await sql`SELECT COUNT(*) as cnt FROM public.tblcard`;
  console.log(`Total cards: ${total[0].cnt}`);

  await sql.end();
})();
