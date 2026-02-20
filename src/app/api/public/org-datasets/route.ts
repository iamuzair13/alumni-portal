import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";

export async function GET() {
  try {
    const facultiesRows = await sql/* sql */`
      SELECT id, faculty_name
      FROM public.tbl_faculties
      ORDER BY faculty_name ASC
    `;

    const departmentsRows = await sql/* sql */`
      SELECT id, department_name, faculty_id
      FROM public.tbl_departments
      WHERE faculty_id IS NOT NULL
      ORDER BY department_name ASC
    `;

    const programsRows = await sql/* sql */`
      SELECT id, program_name, department_id
      FROM public.tbl_programs
      WHERE department_id IS NOT NULL
      ORDER BY program_name ASC
    `;

    const faculties = (facultiesRows as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      faculty_name: String(r.faculty_name ?? ""),
    }));

    const departments = (departmentsRows as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      department_name: String(r.department_name ?? ""),
      faculty_id: r.faculty_id === null ? null : Number(r.faculty_id),
    }));

    const programs = (programsRows as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      program_name: String(r.program_name ?? ""),
      department_id: r.department_id === null ? null : Number(r.department_id),
    }));

    return NextResponse.json({ success: true, faculties, departments, programs }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch org datasets";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
