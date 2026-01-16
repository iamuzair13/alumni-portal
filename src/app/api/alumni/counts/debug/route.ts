import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    // Get sample verify values to see what's actually in the database
    // Handle both boolean and string types
    const samples = await sql/* sql */`
      SELECT 
        verify,
        pg_typeof(verify) as verify_type,
        CASE 
          WHEN verify IS NULL THEN 'NULL'
          WHEN verify::text = 'true' OR verify = true THEN 'true'
          WHEN verify::text = 'false' OR verify = false THEN 'false'
          ELSE verify::text
        END as verify_value,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE sapid IS NOT NULL AND sapid != ''
      GROUP BY verify, pg_typeof(verify)
      ORDER BY count DESC
      LIMIT 10
    `;

    // Also get counts by different methods
    const testCounts = await sql/* sql */`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN verify = true OR verify::text = 'true' THEN 1 END) as is_true,
        COUNT(CASE WHEN verify = false OR verify::text = 'false' THEN 1 END) as is_false,
        COUNT(CASE WHEN verify IS NULL THEN 1 END) as is_null,
        COUNT(CASE WHEN verify::text = '' THEN 1 END) as is_empty_string
      FROM public.tbl_alumni
      WHERE sapid IS NOT NULL AND sapid != ''
    `;

    return NextResponse.json({
      samples: samples,
      testCounts: testCounts[0],
    }, { status: 200 });
  } catch (err) {

    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
