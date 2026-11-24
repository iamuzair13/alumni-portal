import postgres from "postgres";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const ALUMNI_IDS = [26404, 18677, 13319, 39806, 39819, 36118, 36362, 37291, 38247, 37009];

(async () => {
  try {
    await sql.begin(async (tx) => {
      // Lock the rows and re-verify they are still unassigned before writing.
      const before = await tx`
        SELECT id, application_term, application_year
        FROM public.alumni_scholarships
        WHERE id = ANY(${ALUMNI_IDS})
        FOR UPDATE
      `;

      if (before.length !== ALUMNI_IDS.length) {
        throw new Error(`Expected ${ALUMNI_IDS.length} rows, found ${before.length} — aborting`);
      }

      const alreadySet = before.filter(
        (r) => r.application_term != null || r.application_year != null
      );
      if (alreadySet.length > 0) {
        throw new Error(
          `Rows already have term/year set: ${JSON.stringify(alreadySet)} — aborting`
        );
      }

      const updated = await tx`
        UPDATE public.alumni_scholarships
        SET application_term = 'Fall',
            application_year = 2026
        WHERE id = ANY(${ALUMNI_IDS})
        RETURNING id, application_term, application_year
      `;

      console.log(`Updated ${updated.length} rows:`);
      console.table(updated);
    });
    console.log("COMMITTED");
  } catch (e) {
    console.error("ROLLED BACK:", e instanceof Error ? e.message : e);
  }
  await sql.end();
  process.exit(0);
})();
