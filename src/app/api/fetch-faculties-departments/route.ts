import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    // Fetch all unique faculty-department combinations with their programs
    const result = await sql/* sql */`
      SELECT DISTINCT 
        f.faculty_name as facultyname,
        d.department_name as departmentname,
        p.program_name as degreetitle,
        COUNT(*) as count
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE f.faculty_name IS NOT NULL 
        AND TRIM(f.faculty_name) != ''
        AND d.department_name IS NOT NULL 
        AND TRIM(d.department_name) != ''
        AND p.program_name IS NOT NULL 
        AND TRIM(p.program_name) != ''
      GROUP BY f.faculty_name, d.department_name, p.program_name
      ORDER BY facultyname ASC, departmentname ASC, degreetitle ASC
    `;

    // Organize data hierarchically: Faculty -> Department -> Programs
    const facultyMap = new Map<string, Map<string, Array<{ program: string; count: number }>>>();

    for (const row of result as unknown as Array<{ facultyname: string; departmentname: string; degreetitle: string; count: number | string | bigint }>) {
      const faculty = row.facultyname.trim();
      const department = row.departmentname.trim();
      const program = row.degreetitle.trim();
      const count = Number(row.count || 0);

      if (!facultyMap.has(faculty)) {
        facultyMap.set(faculty, new Map());
      }

      const departmentMap = facultyMap.get(faculty)!;
      if (!departmentMap.has(department)) {
        departmentMap.set(department, []);
      }

      departmentMap.get(department)!.push({ program, count });
    }

    // Convert to array structure
    const faculties = Array.from(facultyMap.entries()).map(([faculty, departments]) => ({
      faculty,
      departments: Array.from(departments.entries()).map(([department, programs]) => ({
        department,
        programs: programs.sort((a, b) => a.program.localeCompare(b.program))
      })).sort((a, b) => a.department.localeCompare(b.department))
    })).sort((a, b) => a.faculty.localeCompare(b.faculty));

    // Also get standalone programs (those without faculty/department mapping)
    const standalonePrograms = await sql/* sql */`
      SELECT DISTINCT 
        p.program_name as degreetitle,
        COUNT(*) as count
      FROM public.tbl_alumni a
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      WHERE p.program_name IS NOT NULL 
        AND TRIM(p.program_name) != ''
        AND (a.faculty IS NULL OR a.department IS NULL)
      GROUP BY p.program_name
      ORDER BY degreetitle ASC
    `;

    const standalone = (standalonePrograms as unknown as Array<{ degreetitle: string; count: number | string | bigint }>).map(row => ({
      program: row.degreetitle.trim(),
      count: Number(row.count || 0)
    }));

    return NextResponse.json({
      success: true,
      totalFaculties: faculties.length,
      totalDepartments: faculties.reduce((sum, f) => sum + f.departments.length, 0),
      totalPrograms: faculties.reduce((sum, f) => 
        sum + f.departments.reduce((deptSum, d) => deptSum + d.programs.length, 0), 0
      ) + standalone.length,
      faculties,
      standalonePrograms: standalone
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

