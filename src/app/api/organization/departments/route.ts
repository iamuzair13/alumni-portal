import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

// GET /api/organization/departments - Fetch all or filtered departments
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const facultyId = searchParams.get("faculty_id");

    let rows;
    if (facultyId) {
      // Fetch departments for specific faculty
      const facultyIdNum = parseInt(facultyId, 10);
      if (isNaN(facultyIdNum)) {
        return NextResponse.json({ error: "Invalid faculty ID" }, { status: 400 });
      }

      rows = await sql/* sql */`
        SELECT 
          d.id,
          d.department_name,
          d.faculty_id,
          d.department_code,
          f.faculty_name,
          d.created_at
        FROM public.tbl_departments d
        LEFT JOIN public.tbl_faculties f ON f.id = d.faculty_id
        WHERE d.faculty_id = ${facultyIdNum}
        ORDER BY d.department_name ASC
      `;
    } else {
      // Return all departments
      rows = await sql/* sql */`
        SELECT 
          d.id,
          d.department_name,
          d.faculty_id,
          d.department_code,
          f.faculty_name,
          d.created_at
        FROM public.tbl_departments d
        LEFT JOIN public.tbl_faculties f ON f.id = d.faculty_id
        ORDER BY d.department_name ASC
      `;
    }

    const departments = rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      department_name: String(row.department_name || ""),
      faculty_id: row.faculty_id ? Number(row.faculty_id) : null,
      faculty_name: row.faculty_name ? String(row.faculty_name) : null,
      department_code: row.department_code ? String(row.department_code) : null,
      created_at: row.created_at ? new Date(row.created_at as string) : new Date(),
    }));

    return NextResponse.json({ success: true, departments }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch departments";
    console.error("[API] Error fetching departments:", msg, err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/organization/departments - Create a new department
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { department_name, faculty_id, department_code } = body;

    if (!department_name || typeof department_name !== "string" || !faculty_id) {
      return NextResponse.json({ error: "Department name and faculty ID are required" }, { status: 400 });
    }

    const departmentCodeValue = department_code && typeof department_code === "string" ? department_code.trim() || null : null;

    const rows = await sql/* sql */`
      INSERT INTO public.tbl_departments (department_name, faculty_id, department_code)
      VALUES (${department_name.trim()}, ${Number(faculty_id)}, ${departmentCodeValue})
      RETURNING id, department_name, faculty_id, department_code, created_at
    `;

    // Get faculty name
    const facultyRows = await sql/* sql */`
      SELECT faculty_name FROM public.tbl_faculties WHERE id = ${Number(faculty_id)}
    `;

    const department = {
      id: Number(rows[0].id),
      department_name: String(rows[0].department_name),
      faculty_id: Number(rows[0].faculty_id),
      department_code: rows[0].department_code ? String(rows[0].department_code) : null,
      faculty_name: facultyRows.length > 0 ? String(facultyRows[0].faculty_name) : null,
      created_at: new Date(rows[0].created_at as string),
    };

    return NextResponse.json({ success: true, department }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create department";
    console.error("[API] Error creating department:", msg, err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/organization/departments - Update an existing department
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, department_name, faculty_id, department_code } = body;

    if (!id || !department_name || typeof department_name !== "string" || !faculty_id) {
      return NextResponse.json({ error: "ID, department name, and faculty ID are required" }, { status: 400 });
    }

    const departmentCodeValue = department_code && typeof department_code === "string" ? department_code.trim() || null : null;

    const rows = await sql/* sql */`
      UPDATE public.tbl_departments
      SET department_name = ${department_name.trim()}, faculty_id = ${Number(faculty_id)}, department_code = ${departmentCodeValue}
      WHERE id = ${Number(id)}
      RETURNING id, department_name, faculty_id, department_code, created_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Get faculty name
    const facultyRows = await sql/* sql */`
      SELECT faculty_name FROM public.tbl_faculties WHERE id = ${Number(faculty_id)}
    `;

    const department = {
      id: Number(rows[0].id),
      department_name: String(rows[0].department_name),
      faculty_id: Number(rows[0].faculty_id),
      department_code: rows[0].department_code ? String(rows[0].department_code) : null,
      faculty_name: facultyRows.length > 0 ? String(facultyRows[0].faculty_name) : null,
      created_at: new Date(rows[0].created_at as string),
    };

    return NextResponse.json({ success: true, department }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update department";
    console.error("[API] Error updating department:", msg, err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/organization/departments - Delete a department
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
    }

    // Check if department is referenced by any programs
    const programCheck = await sql/* sql */`
      SELECT COUNT(*) as count FROM public.tbl_programs WHERE department_id = ${Number(id)}
    `;

    if (Number(programCheck[0].count) > 0) {
      return NextResponse.json({ 
        error: "Cannot delete department with associated programs" 
      }, { status: 400 });
    }

    // Check if department is referenced by any alumni
    const alumniCheck = await sql/* sql */`
      SELECT COUNT(*) as count FROM public.tbl_alumni WHERE department = ${Number(id)}
    `;

    if (Number(alumniCheck[0].count) > 0) {
      return NextResponse.json({ 
        error: "Cannot delete department with associated alumni records" 
      }, { status: 400 });
    }

    await sql/* sql */`
      DELETE FROM public.tbl_departments WHERE id = ${Number(id)}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete department";
    console.error("[API] Error deleting department:", msg, err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

