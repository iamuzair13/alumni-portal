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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "faculty");
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
        a.faculty as faculty_id,
        COALESCE(NULLIF(TRIM(COALESCE(f.faculty_name, '')), ''), 'Null') as faculty_label,
        COUNT(*) as count
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      WHERE ${baseWhere}
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY a.faculty, COALESCE(NULLIF(TRIM(COALESCE(f.faculty_name, '')), ''), 'Null')
      ORDER BY faculty_label ASC
    `;

    const faculties = (rows as unknown as Array<{ faculty_id: number | null; faculty_label: string; count: number | string | bigint }>).map((row) => {
      const id = row.faculty_id;
      const label = row.faculty_label || "Null";
      return {
        value: id === null ? "NULL" : String(id),
        label,
        count: Number(row.count || 0),
      };
    });

    return NextResponse.json({ success: true, faculties }, { status: 200 });
  } catch (err) {

    const message = err instanceof Error ? err.message : "Failed to fetch faculties";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


