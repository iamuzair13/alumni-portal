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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "institutionCity");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for institution cities:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique higher education institution city values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN higher_education_institute_city IS NULL OR TRIM(COALESCE(higher_education_institute_city, '')) = '' 
          THEN 'Null'
          ELSE TRIM(higher_education_institute_city)
        END as institution_city_value,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN higher_education_institute_city IS NULL OR TRIM(COALESCE(higher_education_institute_city, '')) = '' 
          THEN 'Null'
          ELSE TRIM(higher_education_institute_city)
        END
      ORDER BY 
        CASE 
          WHEN higher_education_institute_city IS NULL OR TRIM(COALESCE(higher_education_institute_city, '')) = '' 
          THEN 'Null'
          ELSE TRIM(higher_education_institute_city)
        END ASC
    `;

    const institutionCities = (rows as unknown as Array<{ institution_city_value: string; count: number | string | bigint }>).map((row) => {
      const cityValue = row.institution_city_value || 'Null';
      const isNull = cityValue === 'Null';
      return {
        value: isNull ? 'NULL' : cityValue,
        label: cityValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      institutionCities
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching institution cities:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch institution cities";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

