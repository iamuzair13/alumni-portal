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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "homeCountry");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {

      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique home country values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.country IS NULL OR TRIM(COALESCE(a.country, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.country)
        END as country_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.country IS NULL OR TRIM(COALESCE(a.country, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.country)
        END
      ORDER BY 
        CASE 
          WHEN a.country IS NULL OR TRIM(COALESCE(a.country, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.country)
        END ASC
    `;

    const homeCountries = (rows as unknown as Array<{ country_value: string; count: number | string | bigint }>).map((row) => {
      const countryValue = row.country_value || 'Null';
      const isNull = countryValue === 'Null';
      return {
        value: isNull ? 'NULL' : countryValue,
        label: countryValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      homeCountries
    }, { status: 200 });
  } catch (err) {

    const message = err instanceof Error ? err.message : "Failed to fetch home countries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

