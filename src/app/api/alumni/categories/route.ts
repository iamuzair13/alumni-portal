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
    const masterFilterConditions = buildMasterFilterConditions(searchParams, "category");

    // Build access filter
    let accessFilterCondition = sql``;
    try {
      const accessFilter = await buildAccessFilterSQL(session, "");
      accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    } catch (filterError) {
      return NextResponse.json({ error: "Failed to build access filter" }, { status: 500 });
    }

    // Fetch unique category values with counts
    const rows = await sql/* sql */`
      SELECT 
        CASE 
          WHEN a.category IS NULL OR TRIM(COALESCE(a.category, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.category)
        END as category_value,
        COUNT(*) as count
      FROM public.tbl_alumni a
      WHERE (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
        ${accessFilterCondition}
        ${masterFilterConditions}
      GROUP BY 
        CASE 
          WHEN a.category IS NULL OR TRIM(COALESCE(a.category, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.category)
        END
      ORDER BY 
        CASE 
          WHEN a.category IS NULL OR TRIM(COALESCE(a.category, '')) = '' 
          THEN 'Null'
          ELSE TRIM(a.category)
        END ASC
    `;

    const categories = (rows as unknown as Array<{ category_value: string; count: number | string | bigint }>).map((row) => {
      const categoryValue = row.category_value || 'Null';
      const isNull = categoryValue === 'Null';
      // Normalize category value for filter format
      let filterValue: string;
      let displayLabel: string;
      if (isNull) {
        filterValue = 'NULL';
        displayLabel = 'NULL';
      } else {
        const normalized = categoryValue.trim().toUpperCase();
        // Handle A+ category
        if (normalized.startsWith('A+') || normalized === 'A+') {
          filterValue = 'category:aPlus';
          displayLabel = 'A+ Category';
        } else if (normalized.startsWith('A') && !normalized.startsWith('A+')) {
          filterValue = 'category:a';
          displayLabel = 'A Category';
        } else if (normalized.startsWith('B')) {
          filterValue = 'category:b';
          displayLabel = 'B Category';
        } else if (normalized.startsWith('C')) {
          filterValue = 'category:c';
          displayLabel = 'C Category';
        } else if (normalized.startsWith('D')) {
          filterValue = 'category:d';
          displayLabel = 'D Category';
        } else {
          // For any other category value, use it as-is
          filterValue = categoryValue.trim();
          displayLabel = categoryValue.trim();
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
