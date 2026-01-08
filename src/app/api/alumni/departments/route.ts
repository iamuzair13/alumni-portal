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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "department");

    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for departments:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.departmentname IS NULL OR TRIM(COALESCE(a.departmentname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.departmentname)
        END as department_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.departmentname IS NULL OR TRIM(COALESCE(a.departmentname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.departmentname)
        END
      ORDER BY 
        CASE 
          WHEN a.departmentname IS NULL OR TRIM(COALESCE(a.departmentname, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.departmentname)
        END ASC
    `;

    const departments = (rows as unknown as Array<{ department_value: string; count: number | string | bigint }>).map((row) => {
      const departmentValue = row.department_value || "Null";
      const isNull = departmentValue === "Null";
      return {
        value: isNull ? "NULL" : departmentValue,
        label: departmentValue,
        count: Number(row.count || 0),
      };
    });

    return NextResponse.json({ success: true, departments }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching departments:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch departments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


