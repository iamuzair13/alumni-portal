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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "institutionName");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for institution names:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique higher education institution name values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.higher_education_institute_name IS NULL OR TRIM(COALESCE(a.higher_education_institute_name, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.higher_education_institute_name)
        END as institution_name_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.higher_education_institute_name IS NULL OR TRIM(COALESCE(a.higher_education_institute_name, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.higher_education_institute_name)
        END
      ORDER BY 
        CASE 
          WHEN a.higher_education_institute_name IS NULL OR TRIM(COALESCE(a.higher_education_institute_name, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.higher_education_institute_name)
        END ASC
    `;

    const institutionNames = (rows as unknown as Array<{ institution_name_value: string; count: number | string | bigint }>).map((row) => {
      const institutionValue = row.institution_name_value || 'Null';
      const isNull = institutionValue === 'Null';
      return {
        value: isNull ? 'NULL' : institutionValue,
        label: institutionValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      institutionNames
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching institution names:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch institution names";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

