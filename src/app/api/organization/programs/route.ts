import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

// GET - Fetch all programs with their department and faculty information
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
    const departmentId = searchParams.get("department_id");

    let programs;
    if (departmentId && !isNaN(Number(departmentId))) {
      programs = await sql/* sql */`
        SELECT 
          p.id,
          p.program_name,
          p.department_id,
          d.department_name,
          d.faculty_id,
          f.faculty_name,
          p.created_at
        FROM public.tbl_programs p
        LEFT JOIN public.tbl_departments d ON p.department_id = d.id
        LEFT JOIN public.tbl_faculties f ON d.faculty_id = f.id
        WHERE p.department_id = ${Number(departmentId)}
        ORDER BY p.program_name ASC
      `;
    } else {
      programs = await sql/* sql */`
        SELECT 
          p.id,
          p.program_name,
          p.department_id,
          d.department_name,
          d.faculty_id,
          f.faculty_name,
          p.created_at
        FROM public.tbl_programs p
        LEFT JOIN public.tbl_departments d ON p.department_id = d.id
        LEFT JOIN public.tbl_faculties f ON d.faculty_id = f.id
        ORDER BY f.faculty_name ASC, d.department_name ASC, p.program_name ASC
      `;
    }

    return NextResponse.json({ 
      success: true, 
      programs: programs as unknown as Array<{ 
        id: number; 
        program_name: string; 
        department_id: number | null;
        department_name: string | null;
        faculty_id: number | null;
        faculty_name: string | null;
        created_at: Date;
      }>
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching programs:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch programs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Create a new program
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
    const { program_name, department_id } = body;

    if (!program_name || typeof program_name !== "string" || !program_name.trim()) {
      return NextResponse.json({ error: "Program name is required" }, { status: 400 });
    }

    if (!department_id || typeof department_id !== "number") {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
    }

    // Verify department exists
    const department = await sql/* sql */`
      SELECT id FROM public.tbl_departments WHERE id = ${department_id} LIMIT 1
    `;

    if (!department || (Array.isArray(department) && department.length === 0)) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Check if program already exists for this department
    const existing = await sql/* sql */`
      SELECT id FROM public.tbl_programs 
      WHERE LOWER(TRIM(program_name)) = LOWER(TRIM(${program_name.trim()}))
        AND department_id = ${department_id}
      LIMIT 1
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: "Program with this name already exists in this department" }, { status: 409 });
    }

    const result = await sql/* sql */`
      INSERT INTO public.tbl_programs (program_name, department_id)
      VALUES (${program_name.trim()}, ${department_id})
      RETURNING id, program_name, department_id, created_at
    `;

    const newProgram = Array.isArray(result) ? result[0] : result;
    
    // Get department and faculty names for response
    const deptResult = await sql/* sql */`
      SELECT 
        d.department_name,
        d.faculty_id,
        f.faculty_name
      FROM public.tbl_departments d
      LEFT JOIN public.tbl_faculties f ON d.faculty_id = f.id
      WHERE d.id = ${department_id}
      LIMIT 1
    `;
    
    const deptInfo = Array.isArray(deptResult) && deptResult.length > 0
      ? deptResult[0] as { department_name: string; faculty_id: number | null; faculty_name: string | null }
      : { department_name: null, faculty_id: null, faculty_name: null };

    return NextResponse.json({ 
      success: true, 
      program: {
        ...(newProgram as { id: number; program_name: string; department_id: number; created_at: Date }),
        department_name: deptInfo.department_name,
        faculty_id: deptInfo.faculty_id,
        faculty_name: deptInfo.faculty_name
      }
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating program:", error);
    const message = error instanceof Error ? error.message : "Failed to create program";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Update a program
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
    const { id, program_name, department_id } = body;

    // Handle id as number or string that can be converted to number
    const programId = id !== null && id !== undefined 
      ? (typeof id === "number" ? id : (typeof id === "string" && id.trim() !== "" ? Number(id) : null))
      : null;

    if (!programId || isNaN(programId)) {
      return NextResponse.json({ error: "Program ID is required" }, { status: 400 });
    }

    if (!program_name || typeof program_name !== "string" || !program_name.trim()) {
      return NextResponse.json({ error: "Program name is required" }, { status: 400 });
    }

    // Handle department_id as number or string that can be converted to number
    const departmentIdNum = department_id !== null && department_id !== undefined 
      ? (typeof department_id === "number" ? department_id : (typeof department_id === "string" && department_id.trim() !== "" ? Number(department_id) : null))
      : null;

    if (!departmentIdNum || isNaN(departmentIdNum)) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
    }

    // Verify department exists
    const department = await sql/* sql */`
      SELECT id FROM public.tbl_departments WHERE id = ${departmentIdNum} LIMIT 1
    `;

    if (!department || (Array.isArray(department) && department.length === 0)) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Check if another program with the same name exists in this department
    const existing = await sql/* sql */`
      SELECT id FROM public.tbl_programs 
      WHERE LOWER(TRIM(program_name)) = LOWER(TRIM(${program_name.trim()}))
        AND department_id = ${departmentIdNum}
        AND id != ${programId}
      LIMIT 1
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: "Another program with this name already exists in this department" }, { status: 409 });
    }

    const result = await sql/* sql */`
      UPDATE public.tbl_programs
      SET program_name = ${program_name.trim()}, department_id = ${departmentIdNum}
      WHERE id = ${programId}
      RETURNING id, program_name, department_id, created_at
    `;

    const updated = Array.isArray(result) ? result[0] : result;
    if (!updated) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Get department and faculty names for response
    const deptResult = await sql/* sql */`
      SELECT 
        d.department_name,
        d.faculty_id,
        f.faculty_name
      FROM public.tbl_departments d
      LEFT JOIN public.tbl_faculties f ON d.faculty_id = f.id
      WHERE d.id = ${department_id}
      LIMIT 1
    `;
    
    const deptInfo = Array.isArray(deptResult) && deptResult.length > 0
      ? deptResult[0] as { department_name: string; faculty_id: number | null; faculty_name: string | null }
      : { department_name: null, faculty_id: null, faculty_name: null };

    return NextResponse.json({ 
      success: true, 
      program: {
        ...(updated as { id: number; program_name: string; department_id: number; created_at: Date }),
        department_name: deptInfo.department_name,
        faculty_id: deptInfo.faculty_id,
        faculty_name: deptInfo.faculty_name
      }
    }, { status: 200 });
  } catch (error) {
    console.error("Error updating program:", error);
    const message = error instanceof Error ? error.message : "Failed to update program";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Delete a program
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
      return NextResponse.json({ error: "Valid program ID is required" }, { status: 400 });
    }

    const programId = Number(id);

    const result = await sql/* sql */`
      DELETE FROM public.tbl_programs
      WHERE id = ${programId}
      RETURNING id
    `;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting program:", error);
    const message = error instanceof Error ? error.message : "Failed to delete program";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

