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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "campus");
    const baseWhere = buildAlumniPresenceBaseWhere(searchParams);

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {

      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique campus values with counts
    // NULL or empty values will be mapped as "Null"
    // This query fetches all unique campusname values from tbl_alumni with their counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.campusname IS NULL OR TRIM(COALESCE(a.campusname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.campusname)
        END as campus_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE ${baseWhere}
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.campusname IS NULL OR TRIM(COALESCE(a.campusname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.campusname)
        END
      ORDER BY 
        CASE 
          WHEN a.campusname IS NULL OR TRIM(COALESCE(a.campusname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.campusname)
        END ASC
    `;

    if (rows.length === 0) {

    }

    const campuses = (rows as unknown as Array<{ campus_value: string; count: number | string | bigint }>).map((row) => {
      const campusValue = row.campus_value || 'Null';
      const isNull = campusValue === 'Null';
      return {
        value: isNull ? 'NULL' : campusValue,
        label: campusValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      campuses
    }, { status: 200 });
  } catch (err) {

    const message = err instanceof Error ? err.message : "Failed to fetch campuses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

