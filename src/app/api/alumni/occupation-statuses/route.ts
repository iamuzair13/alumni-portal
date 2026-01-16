import { NextResponse } from "next/server";
import { sql, retryDbOperation } from "@/lib/dbconnect";
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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "occupationStatus");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {

      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique occupation status values with counts
    // NULL or empty values will be mapped as "Null"
    // This query fetches all unique employeed values from tbl_alumni with their counts
    const rows = await retryDbOperation(async () => await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.employeed IS NULL OR TRIM(COALESCE(a.employeed, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.employeed)
        END as occupation_status,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.employeed IS NULL OR TRIM(COALESCE(a.employeed, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.employeed)
        END
      ORDER BY 
        CASE 
          WHEN a.employeed IS NULL OR TRIM(COALESCE(a.employeed, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.employeed)
        END ASC
    `);

    if (rows.length === 0) {

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

    return NextResponse.json({
      success: true,
      occupationStatuses
    }, { status: 200 });
  } catch (err) {

    // Check for connection timeout errors
    const isConnectionError = err instanceof Error && (
      err.message.includes('CONNECT_TIMEOUT') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('timeout') ||
      (err as Error & { code?: string }).code === 'CONNECT_TIMEOUT' ||
      (err as Error & { code?: string }).code === 'ETIMEDOUT'
    );
    
    if (isConnectionError) {
      return NextResponse.json({ 
        error: "Database connection timeout. Please try again in a moment.",
        retryable: true
      }, { status: 503 });
    }
    
    const message = err instanceof Error ? err.message : "Failed to fetch occupation statuses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

