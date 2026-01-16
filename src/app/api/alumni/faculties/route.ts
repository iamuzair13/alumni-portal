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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "faculty");

    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {

      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.facultyname IS NULL OR TRIM(COALESCE(a.facultyname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.facultyname)
        END as faculty_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.facultyname IS NULL OR TRIM(COALESCE(a.facultyname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.facultyname)
        END
      ORDER BY 
        CASE 
          WHEN a.facultyname IS NULL OR TRIM(COALESCE(a.facultyname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.facultyname)
        END ASC
    `;

    const faculties = (rows as unknown as Array<{ faculty_value: string; count: number | string | bigint }>).map((row) => {
      const facultyValue = row.faculty_value || "Null";
      const isNull = facultyValue === "Null";
      return {
        value: isNull ? "NULL" : facultyValue,
        label: facultyValue,
        count: Number(row.count || 0),
      };
    });

    return NextResponse.json({ success: true, faculties }, { status: 200 });
  } catch (err) {

    const message = err instanceof Error ? err.message : "Failed to fetch faculties";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


