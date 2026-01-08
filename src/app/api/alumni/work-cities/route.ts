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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "workCity");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for work cities:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique work city values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.work_city IS NULL OR TRIM(COALESCE(a.work_city, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.work_city)
        END as work_city_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.work_city IS NULL OR TRIM(COALESCE(a.work_city, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.work_city)
        END
      ORDER BY 
        CASE 
          WHEN a.work_city IS NULL OR TRIM(COALESCE(a.work_city, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.work_city)
        END ASC
    `;

    const workCities = (rows as unknown as Array<{ work_city_value: string; count: number | string | bigint }>).map((row) => {
      const cityValue = row.work_city_value || 'Null';
      const isNull = cityValue === 'Null';
      return {
        value: isNull ? 'NULL' : cityValue,
        label: cityValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      workCities
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching work cities:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch work cities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

