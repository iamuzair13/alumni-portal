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
    // Note: degree_title is not in master-filter-utils, but we still need to exclude it from filters
    // Since degree_title is a different column than programEnrolled (higher_education_program),
    // we don't have a corresponding excludeField, but we still apply other filters
    const masterFilterConditions = buildMasterFilterConditions(searchParams);

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for degree titles:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique degree title values with counts (from degree_title column, not higher_education_program)
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.degree_title IS NULL OR TRIM(COALESCE(a.degree_title, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.degree_title)
        END as degree_title_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.degree_title IS NULL OR TRIM(COALESCE(a.degree_title, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.degree_title)
        END
      ORDER BY 
        CASE 
          WHEN a.degree_title IS NULL OR TRIM(COALESCE(a.degree_title, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.degree_title)
        END ASC
    `;

    const degreeTitles = (rows as unknown as Array<{ degree_title_value: string; count: number | string | bigint }>).map((row) => {
      const titleValue = row.degree_title_value || 'Null';
      const isNull = titleValue === 'Null';
      return {
        value: isNull ? 'NULL' : titleValue,
        label: titleValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      degreeTitles
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching degree titles:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch degree titles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

