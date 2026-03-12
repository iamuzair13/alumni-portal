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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "employer");
    const baseWhere = buildAlumniPresenceBaseWhere(searchParams);

    // Build access filter
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
          WHEN a.nameoforganization IS NULL OR TRIM(COALESCE(a.nameoforganization, '')) = ''
          THEN 'Null'
          ELSE TRIM(a.nameoforganization)
        END as employer_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE ${baseWhere}
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.nameoforganization IS NULL OR TRIM(COALESCE(a.nameoforganization, '')) = ''
          THEN 'Null'
          ELSE TRIM(a.nameoforganization)
        END
      ORDER BY 
        CASE 
          WHEN a.nameoforganization IS NULL OR TRIM(COALESCE(a.nameoforganization, '')) = ''
          THEN 'Null'
          ELSE TRIM(a.nameoforganization)
        END ASC
    `;

    const employers = (
      rows as unknown as Array<{ employer_value: string; count: number | string | bigint }>
    ).map((row) => {
      const employerValue = row.employer_value || "Null";
      const isNull = employerValue === "Null";
      return {
        value: isNull ? "NULL" : employerValue,
        label: employerValue,
        count: Number(row.count || 0),
      };
    });

    return NextResponse.json(
      {
        success: true,
        employers,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch employers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
