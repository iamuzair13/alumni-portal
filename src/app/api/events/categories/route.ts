import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    // Fetch unique category values from tbl_events
    const rows = await sql/* sql */`
      SELECT DISTINCT 
        TRIM(category) as category_value
      FROM public.tbl_events
      WHERE category IS NOT NULL 
        AND TRIM(category) != ''
      ORDER BY category ASC
    ` as Array<{ category_value: string }>;

    const categories = rows.map((row) => row.category_value).filter(Boolean);

    return NextResponse.json({
      success: true,
      categories
    }, { status: 200 });
  } catch (err) {
    console.error("[API] Error fetching event categories:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch event categories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

