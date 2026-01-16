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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "programEnrolled");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique higher education program values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.higher_education_program IS NULL OR TRIM(COALESCE(a.higher_education_program, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.higher_education_program)
        END as program_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.higher_education_program IS NULL OR TRIM(COALESCE(a.higher_education_program, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.higher_education_program)
        END
      ORDER BY 
        CASE 
          WHEN a.higher_education_program IS NULL OR TRIM(COALESCE(a.higher_education_program, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.higher_education_program)
        END ASC
    `;

    const programsEnrolled = (rows as unknown as Array<{ program_value: string; count: number | string | bigint }>).map((row) => {
      const programValue = row.program_value || 'Null';
      const isNull = programValue === 'Null';
      return {
        value: isNull ? 'NULL' : programValue,
        label: programValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      programsEnrolled
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch programs enrolled";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

