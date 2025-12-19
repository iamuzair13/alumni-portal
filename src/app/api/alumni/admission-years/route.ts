import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN yearofstarting IS NULL 
          THEN 'Null'
          ELSE yearofstarting::text
        END as year_value,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        ${accessFilterCondition}
      GROUP BY 
        CASE 
          WHEN yearofstarting IS NULL 
          THEN 'Null'
          ELSE yearofstarting::text
        END
      ORDER BY 
        CASE 
          WHEN yearofstarting IS NULL 
          THEN 0
          ELSE yearofstarting
        END DESC
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

