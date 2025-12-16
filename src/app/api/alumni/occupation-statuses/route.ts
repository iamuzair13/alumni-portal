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
      console.error("[API] Error building access filter for occupation statuses:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique occupation status values with counts
    // NULL or empty values will be mapped as "Null"
    // This query fetches all unique employeed values from tbl_alumni with their counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN employeed IS NULL OR TRIM(COALESCE(employeed, '')) = '' 
          THEN 'Null'
          ELSE TRIM(employeed)
        END as occupation_status,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        ${accessFilterCondition}
      GROUP BY 
        CASE 
          WHEN employeed IS NULL OR TRIM(COALESCE(employeed, '')) = '' 
          THEN 'Null'
          ELSE TRIM(employeed)
        END
      ORDER BY 
        CASE 
          WHEN employeed IS NULL OR TRIM(COALESCE(employeed, '')) = '' 
          THEN 'Null'
          ELSE TRIM(employeed)
        END ASC
    `;

    console.log("[API] Occupation statuses query returned", rows.length, "rows");
    if (rows.length === 0) {
      console.warn("[API] No occupation status values found in database");
    }

    const occupationStatuses = (rows as unknown as Array<{ occupation_status: string; count: number | string | bigint }>).map((row) => {
      const statusValue = row.occupation_status || 'Null';
      const isNull = statusValue === 'Null';
      return {
        value: isNull ? 'NULL' : statusValue,
        label: statusValue,
        count: Number(row.count || 0)
      };
    });

    console.log("[API] Processed occupation statuses:", JSON.stringify(occupationStatuses, null, 2));

    return NextResponse.json({
      success: true,
      occupationStatuses
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching occupation statuses:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch occupation statuses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

