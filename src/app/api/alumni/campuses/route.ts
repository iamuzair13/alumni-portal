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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "campus");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for campuses:", filterError);
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
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
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

    console.log("[API] Campuses query returned", rows.length, "rows");
    if (rows.length === 0) {
      console.warn("[API] No campus values found in database");
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

    console.log("[API] Processed campuses:", JSON.stringify(campuses, null, 2));

    return NextResponse.json({
      success: true,
      campuses
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching campuses:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch campuses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

