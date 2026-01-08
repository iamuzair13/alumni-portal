import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { buildMasterFilterConditions } from "@/lib/master-filter-utils";

// Pakistan provinces list for filtering
const PAKISTAN_PROVINCES = [
  "Punjab",
  "Sindh",
  "KPK",
  "Balochistan",
  "Islamabad",
  "GB",
  "AJK"
];

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "province");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      console.error("[API] Error building access filter for provinces:", filterError);
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique province values with counts (Pakistan only)
    // Filter to only show Pakistan provinces
    // Build OR conditions for Pakistan provinces using recursive combination
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combineOrConditions = (conditions: any[]): any => {
      if (conditions.length === 0) return sql`1=0`;
      if (conditions.length === 1) return conditions[0];
      if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
      const mid = Math.ceil(conditions.length / 2);
      const left = combineOrConditions(conditions.slice(0, mid));
      const right = combineOrConditions(conditions.slice(mid));
      return sql`${left} OR ${right}`;
    };
    
    const provinceConditions = PAKISTAN_PROVINCES.map(p => sql`LOWER(TRIM(COALESCE(a.province, ''))) = LOWER(TRIM(${p}))`);
    const provinceFilter = combineOrConditions(provinceConditions);
    
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.province IS NULL OR TRIM(COALESCE(a.province, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.province)
        END as province_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
        AND (
          a.province IS NULL 
          OR TRIM(COALESCE(a.province, '')) = '' 
          OR ${provinceFilter}
        )
      GROUP BY 
        CASE 
          WHEN a.province IS NULL OR TRIM(COALESCE(a.province, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.province)
        END
      ORDER BY 
        CASE 
          WHEN a.province IS NULL OR TRIM(COALESCE(a.province, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.province)
        END ASC
    `;

    const provinces = (rows as unknown as Array<{ province_value: string; count: number | string | bigint }>).map((row) => {
      const provinceValue = row.province_value || 'Null';
      const isNull = provinceValue === 'Null';
      return {
        value: isNull ? 'NULL' : provinceValue,
        label: provinceValue,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      provinces
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching provinces:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch provinces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

