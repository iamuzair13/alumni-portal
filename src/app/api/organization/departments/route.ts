import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

// GET - Fetch all departments with their faculty information
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Super Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const facultyId = searchParams.get("faculty_id");

    let departments;
    if (facultyId && !isNaN(Number(facultyId))) {
      departments = await sql/* sql */`
        SELECT 
          d.id,
          d.department_name,
          d.faculty_id,
          f.faculty_name,
          d.created_at
        FROM public.tbl_departments d
        LEFT JOIN public.tbl_faculties f ON d.faculty_id = f.id
        WHERE d.faculty_id = ${Number(facultyId)}
        ORDER BY d.department_name ASC
      `;
    } else {
      departments = await sql/* sql */`
        SELECT 
          d.id,
          d.department_name,
          d.faculty_id,
          f.faculty_name,
          d.created_at
        FROM public.tbl_departments d
        LEFT JOIN public.tbl_faculties f ON d.faculty_id = f.id
        ORDER BY f.faculty_name ASC, d.department_name ASC
      `;
    }

    return NextResponse.json({ 
      success: true, 
      departments: departments as unknown as Array<{ 
        id: number; 
        department_name: string; 
        faculty_id: number | null; 
        faculty_name: string | null;
        created_at: Date;
      }>
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching departments:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch departments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Create a new department
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Super Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { department_name, faculty_id } = body;

    if (!department_name || typeof department_name !== "string" || !department_name.trim()) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 });
    }

    if (!faculty_id || typeof faculty_id !== "number") {
      return NextResponse.json({ error: "Faculty ID is required" }, { status: 400 });
    }

    // Verify faculty exists
    const faculty = await sql/* sql */`
      SELECT id FROM public.tbl_faculties WHERE id = ${faculty_id} LIMIT 1
    `;

    if (!faculty || (Array.isArray(faculty) && faculty.length === 0)) {
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }

    // Check if department already exists for this faculty
    const existing = await sql/* sql */`
      SELECT id FROM public.tbl_departments 
      WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(${department_name.trim()}))
        AND faculty_id = ${faculty_id}
      LIMIT 1
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: "Department with this name already exists in this faculty" }, { status: 409 });
    }

    const result = await sql/* sql */`
      INSERT INTO public.tbl_departments (department_name, faculty_id)
      VALUES (${department_name.trim()}, ${faculty_id})
      RETURNING id, department_name, faculty_id, created_at
    `;

    const newDepartment = Array.isArray(result) ? result[0] : result;
    
    // Get faculty name for response
    const facultyResult = await sql/* sql */`
      SELECT faculty_name FROM public.tbl_faculties WHERE id = ${faculty_id} LIMIT 1
    `;
    const facultyName = Array.isArray(facultyResult) && facultyResult.length > 0
      ? (facultyResult[0] as { faculty_name: string }).faculty_name
      : null;

    return NextResponse.json({ 
      success: true, 
      department: {
        ...(newDepartment as { id: number; department_name: string; faculty_id: number; created_at: Date }),
        faculty_name: facultyName
      }
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating department:", error);
    const message = error instanceof Error ? error.message : "Failed to create department";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Update a department
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Super Admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { id, department_name, faculty_id } = body;

    // Handle id as number or string that can be converted to number
    const departmentId = id !== null && id !== undefined 
      ? (typeof id === "number" ? id : (typeof id === "string" && id.trim() !== "" ? Number(id) : null))
      : null;

    if (!departmentId || isNaN(departmentId)) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
    }

    if (!department_name || typeof department_name !== "string" || !department_name.trim()) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 });
    }

    // Handle faculty_id as number or string that can be converted to number
    const facultyIdNum = faculty_id !== null && faculty_id !== undefined 
      ? (typeof faculty_id === "number" ? faculty_id : (typeof faculty_id === "string" && faculty_id.trim() !== "" ? Number(faculty_id) : null))
      : null;

    if (!facultyIdNum || isNaN(facultyIdNum)) {
      return NextResponse.json({ error: "Faculty ID is required" }, { status: 400 });
    }

    // Verify faculty exists
    const faculty = await sql/* sql */`
      SELECT id FROM public.tbl_faculties WHERE id = ${facultyIdNum} LIMIT 1
    `;

    if (!faculty || (Array.isArray(faculty) && faculty.length === 0)) {
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }

    // Check if another department with the same name exists in this faculty
    const existing = await sql/* sql */`
      SELECT id FROM public.tbl_departments 
      WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(${department_name.trim()}))
        AND faculty_id = ${facultyIdNum}
        AND id != ${departmentId}
      LIMIT 1
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: "Another department with this name already exists in this faculty" }, { status: 409 });
    }

    const result = await sql/* sql */`
      UPDATE public.tbl_departments
      SET department_name = ${department_name.trim()}, faculty_id = ${facultyIdNum}
      WHERE id = ${departmentId}
      RETURNING id, department_name, faculty_id, created_at
    `;

    const updated = Array.isArray(result) ? result[0] : result;
    if (!updated) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Get faculty name for response
    const facultyResult = await sql/* sql */`
      SELECT faculty_name FROM public.tbl_faculties WHERE id = ${faculty_id} LIMIT 1
    `;
    const facultyName = Array.isArray(facultyResult) && facultyResult.length > 0
      ? (facultyResult[0] as { faculty_name: string }).faculty_name
      : null;

    return NextResponse.json({ 
      success: true, 
      department: {
        ...(updated as { id: number; department_name: string; faculty_id: number; created_at: Date }),
        faculty_name: facultyName
      }
    }, { status: 200 });
  } catch (error) {
    console.error("Error updating department:", error);
    const message = error instanceof Error ? error.message : "Failed to update department";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Delete a department
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Super Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: "Valid department ID is required" }, { status: 400 });
    }

    const departmentId = Number(id);

    // Check if department has programs
    const programs = await sql/* sql */`
      SELECT COUNT(*) as count FROM public.tbl_programs 
      WHERE department_id = ${departmentId}
    `;

    const progCount = Array.isArray(programs) && programs.length > 0 
      ? Number((programs[0] as { count: number | string | bigint }).count) 
      : 0;

    if (progCount > 0) {
      return NextResponse.json({ 
        error: `Cannot delete department. It has ${progCount} program(s) associated with it. Please delete or reassign programs first.` 
      }, { status: 409 });
    }

    const result = await sql/* sql */`
      DELETE FROM public.tbl_departments
      WHERE id = ${departmentId}
      RETURNING id
    `;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting department:", error);
    const message = error instanceof Error ? error.message : "Failed to delete department";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

