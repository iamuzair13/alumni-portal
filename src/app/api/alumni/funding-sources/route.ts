import { NextResponse } from "next/server";
import { sql, retryDbOperation } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { buildAlumniPresenceBaseWhere, buildMasterFilterConditions } from "@/lib/master-filter-utils";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "fundingSource");
    const baseWhere = buildAlumniPresenceBaseWhere(searchParams);

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique scholarship/funding source values with counts
    const rows = await retryDbOperation(async () => await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.is_scholarship IS NULL OR TRIM(COALESCE(a.is_scholarship, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.is_scholarship)
        END as funding_source_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE ${baseWhere}
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.is_scholarship IS NULL OR TRIM(COALESCE(a.is_scholarship, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.is_scholarship)
        END
      ORDER BY 
        CASE 
          WHEN a.is_scholarship IS NULL OR TRIM(COALESCE(a.is_scholarship, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.is_scholarship)
        END ASC
    `);

    const fundingSources = (rows as unknown as Array<{ funding_source_value: string; count: number | string | bigint }>).map((row) => {
      const fundingValue = row.funding_source_value || 'Null';
      const isNull = fundingValue === 'Null';
      return {
        value: isNull ? 'NULL' : fundingValue,
        label: fundingValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      fundingSources
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
    
    const message = err instanceof Error ? err.message : "Failed to fetch funding sources";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

