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
      console.error("[API] Error building access filter for marital statuses:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique marital status values with counts
    // NULL or empty values will be mapped as "Null"
    // Note: We filter for valid alumni records (have sapid or registrationno) and apply access filter
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN maritalstatus IS NULL OR TRIM(COALESCE(maritalstatus, '')) = '' 
          THEN 'Null'
          ELSE TRIM(maritalstatus)
        END as marital_status,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        ${accessFilterCondition}
      GROUP BY 
        CASE 
          WHEN maritalstatus IS NULL OR TRIM(COALESCE(maritalstatus, '')) = '' 
          THEN 'Null'
          ELSE TRIM(maritalstatus)
        END
      ORDER BY 
        CASE 
          WHEN maritalstatus IS NULL OR TRIM(COALESCE(maritalstatus, '')) = '' 
          THEN 'Null'
          ELSE TRIM(maritalstatus)
        END ASC
    `;

    console.log("[API] Marital statuses query returned", rows.length, "rows");

    const maritalStatuses = (rows as unknown as Array<{ marital_status: string; count: number | string | bigint }>).map((row) => ({
      value: row.marital_status === 'Null' ? 'NULL' : row.marital_status,
      label: row.marital_status,
      count: Number(row.count || 0)
    }));

    console.log("[API] Processed marital statuses:", maritalStatuses.length, "items");

    return NextResponse.json({
      success: true,
      maritalStatuses
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching marital statuses:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch marital statuses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
