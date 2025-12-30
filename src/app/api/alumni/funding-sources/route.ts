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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "fundingSource");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for funding sources:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique scholarship/funding source values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN is_scholarship IS NULL OR TRIM(COALESCE(is_scholarship, '')) = '' 
          THEN 'Null'
          ELSE TRIM(is_scholarship)
        END as funding_source_value,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN is_scholarship IS NULL OR TRIM(COALESCE(is_scholarship, '')) = '' 
          THEN 'Null'
          ELSE TRIM(is_scholarship)
        END
      ORDER BY 
        CASE 
          WHEN is_scholarship IS NULL OR TRIM(COALESCE(is_scholarship, '')) = '' 
          THEN 'Null'
          ELSE TRIM(is_scholarship)
        END ASC
    `;

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
    console.error("[API] Error fetching funding sources:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch funding sources";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

