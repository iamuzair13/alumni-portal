import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

// GET /api/organization/programs - Fetch all or filtered programs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get("department_id");

    let rows;
    if (departmentId) {
      // Fetch programs for specific department
      const departmentIdNum = parseInt(departmentId, 10);
      if (isNaN(departmentIdNum)) {
        return NextResponse.json({ error: "Invalid department ID" }, { status: 400 });
      }

      rows = await sql/* sql */`
        SELECT 
          p.id,
          p.program_name,
          p.department_id,
          p.program_abv,
          d.department_name,
          d.faculty_id,
          f.faculty_name,
          p.created_at
        FROM public.tbl_programs p
        LEFT JOIN public.tbl_departments d ON d.id = p.department_id
        LEFT JOIN public.tbl_faculties f ON f.id = d.faculty_id
        WHERE p.department_id = ${departmentIdNum}
        ORDER BY p.program_name ASC
      `;
    } else {
      // Return all programs
      rows = await sql/* sql */`
        SELECT 
          p.id,
          p.program_name,
          p.department_id,
          p.program_abv,
          d.department_name,
          d.faculty_id,
          f.faculty_name,
          p.created_at
        FROM public.tbl_programs p
        LEFT JOIN public.tbl_departments d ON d.id = p.department_id
        LEFT JOIN public.tbl_faculties f ON f.id = d.faculty_id
        ORDER BY p.program_name ASC
      `;
    }

    const programs = rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      program_name: String(row.program_name || ""),
      department_id: row.department_id ? Number(row.department_id) : null,
      department_name: row.department_name ? String(row.department_name) : null,
      faculty_id: row.faculty_id ? Number(row.faculty_id) : null,
      faculty_name: row.faculty_name ? String(row.faculty_name) : null,
      program_abv: row.program_abv ? String(row.program_abv) : null,
      created_at: row.created_at ? new Date(row.created_at as string) : new Date(),
    }));

    return NextResponse.json({ success: true, programs }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch programs";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/organization/programs - Create a new program
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { program_name, department_id, program_abv } = body;

    if (!program_name || typeof program_name !== "string" || !department_id) {
      return NextResponse.json({ error: "Program name and department ID are required" }, { status: 400 });
    }

    const programAbvValue = program_abv && typeof program_abv === "string" ? program_abv.trim() || null : null;

    const rows = await sql/* sql */`
      INSERT INTO public.tbl_programs (program_name, department_id, program_abv)
      VALUES (${program_name.trim()}, ${Number(department_id)}, ${programAbvValue})
      RETURNING id, program_name, department_id, program_abv, created_at
    `;

    // Get department and faculty names
    const deptRows = await sql/* sql */`
      SELECT d.department_name, d.faculty_id, f.faculty_name
      FROM public.tbl_departments d
      LEFT JOIN public.tbl_faculties f ON f.id = d.faculty_id
      WHERE d.id = ${Number(department_id)}
    `;

    const program = {
      id: Number(rows[0].id),
      program_name: String(rows[0].program_name),
      department_id: Number(rows[0].department_id),
      program_abv: rows[0].program_abv ? String(rows[0].program_abv) : null,
      department_name: deptRows.length > 0 ? String(deptRows[0].department_name) : null,
      faculty_id: deptRows.length > 0 && deptRows[0].faculty_id ? Number(deptRows[0].faculty_id) : null,
      faculty_name: deptRows.length > 0 ? String(deptRows[0].faculty_name) : null,
      created_at: new Date(rows[0].created_at as string),
    };

    return NextResponse.json({ success: true, program }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create program";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/organization/programs - Update an existing program
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, program_name, department_id, program_abv } = body;

    if (!id || !program_name || typeof program_name !== "string" || !department_id) {
      return NextResponse.json({ error: "ID, program name, and department ID are required" }, { status: 400 });
    }

    const programAbvValue = program_abv && typeof program_abv === "string" ? program_abv.trim() || null : null;

    const rows = await sql/* sql */`
      UPDATE public.tbl_programs
      SET program_name = ${program_name.trim()}, department_id = ${Number(department_id)}, program_abv = ${programAbvValue}
      WHERE id = ${Number(id)}
      RETURNING id, program_name, department_id, program_abv, created_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Get department and faculty names
    const deptRows = await sql/* sql */`
      SELECT d.department_name, d.faculty_id, f.faculty_name
      FROM public.tbl_departments d
      LEFT JOIN public.tbl_faculties f ON f.id = d.faculty_id
      WHERE d.id = ${Number(department_id)}
    `;

    const program = {
      id: Number(rows[0].id),
      program_name: String(rows[0].program_name),
      department_id: Number(rows[0].department_id),
      program_abv: rows[0].program_abv ? String(rows[0].program_abv) : null,
      department_name: deptRows.length > 0 ? String(deptRows[0].department_name) : null,
      faculty_id: deptRows.length > 0 && deptRows[0].faculty_id ? Number(deptRows[0].faculty_id) : null,
      faculty_name: deptRows.length > 0 ? String(deptRows[0].faculty_name) : null,
      created_at: new Date(rows[0].created_at as string),
    };

    return NextResponse.json({ success: true, program }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update program";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/organization/programs - Delete a program
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Program ID is required" }, { status: 400 });
    }

    // Check if program is referenced by any alumni
    const alumniCheck = await sql/* sql */`
      SELECT COUNT(*) as count FROM public.tbl_alumni WHERE program = ${Number(id)}
    `;

    if (Number(alumniCheck[0].count) > 0) {
      return NextResponse.json({ 
        error: "Cannot delete program with associated alumni records" 
      }, { status: 400 });
    }

    await sql/* sql */`
      DELETE FROM public.tbl_programs WHERE id = ${Number(id)}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete program";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
