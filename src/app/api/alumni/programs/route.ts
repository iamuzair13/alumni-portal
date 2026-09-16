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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "program");
    const baseWhere = buildAlumniPresenceBaseWhere(searchParams);

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
          WHEN p.program_name IS NULL OR TRIM(COALESCE(p.program_name, '')) = '' 
          THEN 'Null'
          ELSE TRIM(p.program_name)
        END as program_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE ${baseWhere}
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN p.program_name IS NULL OR TRIM(COALESCE(p.program_name, '')) = '' 
          THEN 'Null'
          ELSE TRIM(p.program_name)
        END
      ORDER BY 
        CASE 
          WHEN p.program_name IS NULL OR TRIM(COALESCE(p.program_name, '')) = '' 
          THEN 'Null'
          ELSE TRIM(p.program_name)
        END ASC
    `;

    const programs = (rows as unknown as Array<{ program_value: string; count: number | string | bigint }>).map((row) => {
      const programValue = row.program_value || "Null";
      const isNull = programValue === "Null";
      return {
        value: isNull ? "NULL" : programValue,
        label: programValue,
        count: Number(row.count || 0),
      };
    });

    return NextResponse.json({ success: true, programs }, { status: 200 });
  } catch (err) {

    const message = err instanceof Error ? err.message : "Failed to fetch programs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


