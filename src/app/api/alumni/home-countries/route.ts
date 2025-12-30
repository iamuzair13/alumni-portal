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
      console.error("[API] Error building access filter for home countries:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique home country values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN country IS NULL OR TRIM(COALESCE(country, '')) = '' 
          THEN 'Null'
          ELSE TRIM(country)
        END as country_value,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN country IS NULL OR TRIM(COALESCE(country, '')) = '' 
          THEN 'Null'
          ELSE TRIM(country)
        END
      ORDER BY 
        CASE 
          WHEN country IS NULL OR TRIM(COALESCE(country, '')) = '' 
          THEN 'Null'
          ELSE TRIM(country)
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
    console.error("[API] Error fetching home countries:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch home countries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

