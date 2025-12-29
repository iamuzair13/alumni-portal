import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { buildMasterFilterConditions } from "@/lib/master-filter-utils";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "admissionYear");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for admission years:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique admission year values with counts
    // Use subquery to properly handle GROUP BY and ORDER BY
    const rows = await sql/* sql */`
      WITH year_data AS (
        SELECT 
          CASE 
            WHEN yearofstarting IS NULL 
            THEN 'Null'
            ELSE yearofstarting::text
          END as year_value,
          yearofstarting as year_raw,
          COUNT(*) as count
        FROM public.tbl_alumni
        WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
          ${accessFilterCondition}
          ${masterFilterConditions}
        GROUP BY 
          CASE 
            WHEN yearofstarting IS NULL 
            THEN 'Null'
            ELSE yearofstarting::text
          END,
          yearofstarting
      )
      SELECT year_value, count
      FROM year_data
      ORDER BY 
        CASE 
          WHEN year_value = 'Null' 
          THEN 1
          ELSE 0
        END ASC,
        year_raw DESC NULLS LAST
    `;

    const admissionYears = (rows as unknown as Array<{ year_value: string; count: number | string | bigint }>).map((row) => {
      const yearValue = row.year_value || 'Null';
      const isNull = yearValue === 'Null';
      return {
        value: isNull ? 'NULL' : yearValue,
        label: yearValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      admissionYears
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching admission years:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch admission years";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

