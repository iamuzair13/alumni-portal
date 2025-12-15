import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all faculties with record counts from tbl_alumni
    // Start from tbl_faculties to ensure all faculties are shown, even with 0 records
    const facultyStats = await sql/* sql */`
      SELECT 
        f.id as faculty_id,
        f.faculty_name,
        COUNT(CASE 
          WHEN a.faculty IS NOT NULL 
            AND (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
          THEN 1 
        END) as record_count
      FROM public.tbl_faculties f
      LEFT JOIN public.tbl_alumni a ON a.faculty = f.id
      GROUP BY f.id, f.faculty_name
      ORDER BY record_count DESC, f.faculty_name
    `;

    // Fetch all departments with record counts from tbl_alumni
    // Start from tbl_departments to ensure all departments are shown, even with 0 records
    const departmentStats = await sql/* sql */`
      SELECT 
        d.id as department_id,
        d.department_name,
        COUNT(CASE 
          WHEN a.department IS NOT NULL 
            AND (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
          THEN 1 
        END) as record_count
      FROM public.tbl_departments d
      LEFT JOIN public.tbl_alumni a ON a.department = d.id
      GROUP BY d.id, d.department_name
      ORDER BY record_count DESC, d.department_name
    `;

    // Fetch all programs with record counts from tbl_alumni
    // Start from tbl_programs to ensure all programs are shown, even with 0 records
    const programStats = await sql/* sql */`
      SELECT 
        p.id as program_id,
        p.program_name,
        COUNT(CASE 
          WHEN a.program IS NOT NULL 
            AND (a.sapid IS NOT NULL AND a.sapid != '' OR a.registrationno IS NOT NULL AND a.registrationno != '')
          THEN 1 
        END) as record_count
      FROM public.tbl_programs p
      LEFT JOIN public.tbl_alumni a ON a.program = p.id
      GROUP BY p.id, p.program_name
      ORDER BY record_count DESC, p.program_name
    `;

    // Get NULL counts
    const nullFacultyCount = await sql/* sql */`
      SELECT COUNT(*) as count
      FROM public.tbl_alumni
      WHERE faculty IS NULL
        AND (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
    `;

    const nullDepartmentCount = await sql/* sql */`
      SELECT COUNT(*) as count
      FROM public.tbl_alumni
      WHERE department IS NULL
        AND (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
    `;

    const nullProgramCount = await sql/* sql */`
      SELECT COUNT(*) as count
      FROM public.tbl_alumni
      WHERE program IS NULL
        AND (sapid IS NOT NULL AND sapid != '' OR registrationno IS NOT NULL AND registrationno != '')
    `;

    return NextResponse.json({ 
      faculties: facultyStats,
      departments: departmentStats,
      programs: programStats,
      nullCounts: {
        faculty: Number(nullFacultyCount[0]?.count || 0),
        department: Number(nullDepartmentCount[0]?.count || 0),
        program: Number(nullProgramCount[0]?.count || 0),
      }
    }, { status: 200 });
  } catch (error) {
    console.error("[API] Error fetching test data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch test data" },
      { status: 500 }
    );
  }
}

