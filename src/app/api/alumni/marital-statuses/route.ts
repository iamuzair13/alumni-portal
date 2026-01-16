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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "maritalStatus");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {

      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique marital status values with counts
    // NULL or empty values will be mapped as "Null"
    // Note: We filter for valid alumni records (have sapid or registrationno) and apply access filter
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.maritalstatus IS NULL OR TRIM(COALESCE(a.maritalstatus, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.maritalstatus)
        END as marital_status,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.maritalstatus IS NULL OR TRIM(COALESCE(a.maritalstatus, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.maritalstatus)
        END
      ORDER BY 
        CASE 
          WHEN a.maritalstatus IS NULL OR TRIM(COALESCE(a.maritalstatus, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.maritalstatus)
        END ASC
    `;

    const maritalStatuses = (rows as unknown as Array<{ marital_status: string; count: number | string | bigint }>).map((row) => ({
      value: row.marital_status === 'Null' ? 'NULL' : row.marital_status,
      label: row.marital_status,
      count: Number(row.count || 0)
    }));

    return NextResponse.json({
      success: true,
      maritalStatuses
    }, { status: 200 });
  } catch (err) {

    const message = err instanceof Error ? err.message : "Failed to fetch marital statuses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
