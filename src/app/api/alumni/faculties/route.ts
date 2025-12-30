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
      console.error("[API] Error building access filter for faculties:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN facultyname IS NULL OR TRIM(COALESCE(facultyname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(facultyname)
        END as faculty_value,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN facultyname IS NULL OR TRIM(COALESCE(facultyname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(facultyname)
        END
      ORDER BY 
        CASE 
          WHEN facultyname IS NULL OR TRIM(COALESCE(facultyname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(facultyname)
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
    console.error("[API] Error fetching faculties:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch faculties";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


