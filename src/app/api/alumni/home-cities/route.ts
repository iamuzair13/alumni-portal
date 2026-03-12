import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "homeCity");
    const baseWhere = buildAlumniPresenceBaseWhere(searchParams);

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique home city values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.city IS NULL OR TRIM(COALESCE(a.city, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.city)
        END as city_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE ${baseWhere}
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.city IS NULL OR TRIM(COALESCE(a.city, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.city)
        END
      ORDER BY 
        CASE 
          WHEN a.city IS NULL OR TRIM(COALESCE(a.city, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.city)
        END ASC
    `;

    const homeCities = (rows as unknown as Array<{ city_value: string; count: number | string | bigint }>).map((row) => {
      const cityValue = row.city_value || 'Null';
      const isNull = cityValue === 'Null';
      return {
        value: isNull ? 'NULL' : cityValue,
        label: cityValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      homeCities
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch home cities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

