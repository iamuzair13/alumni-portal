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
        SELECT DISTINCT p.program_name as program
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE f.faculty_name = ${faculty}
          AND d.department_name = ${department}
          AND p.program_name IS NOT NULL
          AND p.program_name != ''
          AND TRIM(p.program_name) != ''
        ORDER BY program ASC
      `;
    } else if (faculty) {
      // Get programs for specific faculty
      query = sql/* sql */`
        SELECT DISTINCT p.program_name as program
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE f.faculty_name = ${faculty}
          AND p.program_name IS NOT NULL
          AND p.program_name != ''
          AND TRIM(p.program_name) != ''
        ORDER BY program ASC
      `;
    } else if (department) {
      // Get programs for specific department
      query = sql/* sql */`
        SELECT DISTINCT p.program_name as program
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE d.department_name = ${department}
          AND p.program_name IS NOT NULL
          AND p.program_name != ''
          AND TRIM(p.program_name) != ''
        ORDER BY program ASC
      `;
    } else {
      // Get all distinct programs
      query = sql/* sql */`
        SELECT DISTINCT p.program_name as program
        FROM public.tbl_alumni a
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE p.program_name IS NOT NULL
          AND p.program_name != ''
          AND TRIM(p.program_name) != ''
        ORDER BY program ASC
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

