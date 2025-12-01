import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

/**
 * GET /api/university/programs
 * Fetches distinct programs (degreetitle) from alumni data
 * Optional query params: faculty, department
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const faculty = searchParams.get("faculty");
    const department = searchParams.get("department");

    let query;
    if (faculty && department) {
      // Get programs for specific faculty and department
      query = sql/* sql */`
        SELECT DISTINCT degreetitle as program
        FROM public.tbl_alumni
        WHERE facultyname = ${faculty}
          AND departmentname = ${department}
          AND degreetitle IS NOT NULL
          AND degreetitle != ''
          AND TRIM(degreetitle) != ''
        ORDER BY degreetitle ASC
      `;
    } else if (faculty) {
      // Get programs for specific faculty
      query = sql/* sql */`
        SELECT DISTINCT degreetitle as program
        FROM public.tbl_alumni
        WHERE facultyname = ${faculty}
          AND degreetitle IS NOT NULL
          AND degreetitle != ''
          AND TRIM(degreetitle) != ''
        ORDER BY degreetitle ASC
      `;
    } else if (department) {
      // Get programs for specific department
      query = sql/* sql */`
        SELECT DISTINCT degreetitle as program
        FROM public.tbl_alumni
        WHERE departmentname = ${department}
          AND degreetitle IS NOT NULL
          AND degreetitle != ''
          AND TRIM(degreetitle) != ''
        ORDER BY degreetitle ASC
      `;
    } else {
      // Get all distinct programs
      query = sql/* sql */`
        SELECT DISTINCT degreetitle as program
        FROM public.tbl_alumni
        WHERE degreetitle IS NOT NULL
          AND degreetitle != ''
          AND TRIM(degreetitle) != ''
        ORDER BY degreetitle ASC
      `;
    }

    const rows = await query;
    const programs = rows.map((r) => {
      const row = r as { program?: string | null };
      return row.program || "";
    }).filter(Boolean);

    return NextResponse.json({ programs }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch programs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

