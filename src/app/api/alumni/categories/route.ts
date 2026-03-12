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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "category");
    const baseWhere = buildAlumniPresenceBaseWhere(searchParams);

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch normalized category buckets with counts.
    // We group by logical buckets (A+, A, B, C, D, NULL, OTHER) so that
    // all variants (e.g. "A+1", "A+ special") are combined into a single option.
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.category IS NULL OR TRIM(COALESCE(a.category, '')) = '' THEN 'Null'
          WHEN LOWER(TRIM(a.category)) LIKE 'a+%' THEN 'A+'
          WHEN LOWER(TRIM(a.category)) LIKE 'a%' AND LOWER(TRIM(a.category)) NOT LIKE 'a+%' THEN 'A'
          WHEN LOWER(TRIM(a.category)) LIKE 'b%' THEN 'B'
          WHEN LOWER(TRIM(a.category)) LIKE 'c%' THEN 'C'
          WHEN LOWER(TRIM(a.category)) LIKE 'd%' THEN 'D'
          ELSE TRIM(a.category)
        END as category_bucket,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE ${baseWhere}
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.category IS NULL OR TRIM(COALESCE(a.category, '')) = '' THEN 'Null'
          WHEN LOWER(TRIM(a.category)) LIKE 'a+%' THEN 'A+'
          WHEN LOWER(TRIM(a.category)) LIKE 'a%' AND LOWER(TRIM(a.category)) NOT LIKE 'a+%' THEN 'A'
          WHEN LOWER(TRIM(a.category)) LIKE 'b%' THEN 'B'
          WHEN LOWER(TRIM(a.category)) LIKE 'c%' THEN 'C'
          WHEN LOWER(TRIM(a.category)) LIKE 'd%' THEN 'D'
          ELSE TRIM(a.category)
        END
      ORDER BY 
        CASE 
          WHEN a.category IS NULL OR TRIM(COALESCE(a.category, '')) = '' THEN 'Null'
          WHEN LOWER(TRIM(a.category)) LIKE 'a+%' THEN 'A+'
          WHEN LOWER(TRIM(a.category)) LIKE 'a%' AND LOWER(TRIM(a.category)) NOT LIKE 'a+%' THEN 'A'
          WHEN LOWER(TRIM(a.category)) LIKE 'b%' THEN 'B'
          WHEN LOWER(TRIM(a.category)) LIKE 'c%' THEN 'C'
          WHEN LOWER(TRIM(a.category)) LIKE 'd%' THEN 'D'
          ELSE TRIM(a.category)
        END ASC
    `;

    const categories = (rows as unknown as Array<{ category_bucket: string; count: number | string | bigint }>).map((row) => {
      const bucket = row.category_bucket || "Null";
      const isNull = bucket === "Null";
      // Normalize category value for filter format
      let filterValue: string;
      let displayLabel: string;
      if (isNull) {
        filterValue = "NULL";
        displayLabel = "NULL";
      } else {
        const normalized = bucket.trim().toUpperCase();
        if (normalized === "A+") {
          filterValue = "category:aPlus";
          displayLabel = "A+ Category";
        } else if (normalized === "A") {
          filterValue = "category:a";
          displayLabel = "A Category";
        } else if (normalized === "B") {
          filterValue = "category:b";
          displayLabel = "B Category";
        } else if (normalized === "C") {
          filterValue = "category:c";
          displayLabel = "C Category";
        } else if (normalized === "D") {
          filterValue = "category:d";
          displayLabel = "D Category";
        } else {
          // For any other category value, expose the raw bucket
          filterValue = bucket.trim();
          displayLabel = bucket.trim();
        }
      }
      return {
        value: filterValue,
        label: displayLabel,
        count: Number(row.count || 0)
      };
    });

    return NextResponse.json({
      success: true,
      categories
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch categories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
