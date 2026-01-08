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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "gender");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for genders:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique gender values with counts
    // NULL or empty values will be mapped as "Null"
    // This query fetches all unique gender values from tbl_alumni with their counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.gender IS NULL OR TRIM(COALESCE(a.gender, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.gender)
        END as gender_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.gender IS NULL OR TRIM(COALESCE(a.gender, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.gender)
        END
      ORDER BY 
        CASE 
          WHEN a.gender IS NULL OR TRIM(COALESCE(a.gender, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.gender)
        END ASC
    `;

    console.log("[API] Genders query returned", rows.length, "rows");
    if (rows.length === 0) {
      console.warn("[API] No gender values found in database");
    }

    const genders = (rows as unknown as Array<{ gender_value: string; count: number | string | bigint }>).map((row) => {
      const genderValue = row.gender_value || 'Null';
      const isNull = genderValue === 'Null';
      return {
        value: isNull ? 'NULL' : genderValue,
        label: genderValue,
        count: Number(row.count || 0)
      };
    });

    console.log("[API] Processed genders:", JSON.stringify(genders, null, 2));

    return NextResponse.json({
      success: true,
      genders
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching genders:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch genders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

