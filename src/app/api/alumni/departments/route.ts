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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "department");
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
        a.department as department_id,
        COALESCE(NULLIF(TRIM(COALESCE(d.department_name, '')), ''), 'Null') as department_label,
        COUNT(*) as count
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      WHERE ${baseWhere}
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY a.department, COALESCE(NULLIF(TRIM(COALESCE(d.department_name, '')), ''), 'Null')
      ORDER BY department_label ASC
    `;

    const departments = (rows as unknown as Array<{ department_id: number | null; department_label: string; count: number | string | bigint }>).map((row) => {
      const id = row.department_id;
      const label = row.department_label || "Null";
      return {
        value: id === null ? "NULL" : String(id),
        label,
        count: Number(row.count || 0),
      };
    });

    return NextResponse.json({ success: true, departments }, { status: 200 });
  } catch (err) {

    const message = err instanceof Error ? err.message : "Failed to fetch departments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


