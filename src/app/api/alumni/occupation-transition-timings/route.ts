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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "occupationTransitionTiming");
    const baseWhere = buildAlumniPresenceBaseWhere(searchParams);

    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch {

      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.occupation_transition_timing IS NULL OR TRIM(COALESCE(a.occupation_transition_timing, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.occupation_transition_timing)
        END as timing_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE ${baseWhere}
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.occupation_transition_timing IS NULL OR TRIM(COALESCE(a.occupation_transition_timing, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.occupation_transition_timing)
        END
      ORDER BY 
        CASE 
          WHEN a.occupation_transition_timing IS NULL OR TRIM(COALESCE(a.occupation_transition_timing, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.occupation_transition_timing)
        END ASC
    `;

    const occupationTransitionTimings = (rows as unknown as Array<{ timing_value: string; count: number | string | bigint }>).map((row) => {
      const raw = row.timing_value || "Null";
      const isNull = raw === "Null";
      return {
        value: isNull ? "NULL" : raw,
        label: raw,
        count: Number(row.count || 0),
      };
    });

    return NextResponse.json({
      success: true,
      occupationTransitionTimings,
    }, { status: 200 });
  } catch (err) {

    const message = err instanceof Error ? err.message : "Failed to fetch occupation transition timings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
