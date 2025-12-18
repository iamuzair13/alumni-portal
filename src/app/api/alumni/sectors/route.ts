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
      console.error("[API] Error building access filter for sectors:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique sector/industry values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN industry IS NULL OR TRIM(COALESCE(industry, '')) = '' 
          THEN 'Null'
          ELSE TRIM(industry)
        END as sector_value,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        ${accessFilterCondition}
      GROUP BY 
        CASE 
          WHEN industry IS NULL OR TRIM(COALESCE(industry, '')) = '' 
          THEN 'Null'
          ELSE TRIM(industry)
        END
      ORDER BY 
        CASE 
          WHEN industry IS NULL OR TRIM(COALESCE(industry, '')) = '' 
          THEN 'Null'
          ELSE TRIM(industry)
        END ASC
    `;

    const sectors = (rows as unknown as Array<{ sector_value: string; count: number | string | bigint }>).map((row) => {
      const sectorValue = row.sector_value || 'Null';
      const isNull = sectorValue === 'Null';
      return {
        value: isNull ? 'NULL' : sectorValue,
        label: sectorValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      sectors
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching sectors:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch sectors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

