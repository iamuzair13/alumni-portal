import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for work countries:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique work country values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN work_country IS NULL OR TRIM(COALESCE(work_country, '')) = '' 
          THEN 'Null'
          ELSE TRIM(work_country)
        END as work_country_value,
        COUNT(*) as count
      FROM public.tbl_alumni
      WHERE (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
        ${accessFilterCondition}
      GROUP BY 
        CASE 
          WHEN work_country IS NULL OR TRIM(COALESCE(work_country, '')) = '' 
          THEN 'Null'
          ELSE TRIM(work_country)
        END
      ORDER BY 
        CASE 
          WHEN work_country IS NULL OR TRIM(COALESCE(work_country, '')) = '' 
          THEN 'Null'
          ELSE TRIM(work_country)
        END ASC
    `;

    const workCountries = (rows as unknown as Array<{ work_country_value: string; count: number | string | bigint }>).map((row) => {
      const countryValue = row.work_country_value || 'Null';
      const isNull = countryValue === 'Null';
      return {
        value: isNull ? 'NULL' : countryValue,
        label: countryValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      workCountries
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching work countries:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch work countries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

