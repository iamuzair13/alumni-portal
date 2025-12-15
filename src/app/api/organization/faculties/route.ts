import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

// GET - Fetch all faculties
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden - Super Admin only" }, { status: 403 });
    }

    const faculties = await sql/* sql */`
      SELECT 
        id,
        faculty_name,
        created_at
      FROM public.tbl_faculties
      ORDER BY faculty_name ASC
    `;

    return NextResponse.json({ 
      success: true, 
      faculties: faculties as unknown as Array<{ id: number; faculty_name: string; created_at: Date }>
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching faculties:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch faculties";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Create a new faculty
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
    const { faculty_name } = body;

    if (!faculty_name || typeof faculty_name !== "string" || !faculty_name.trim()) {
      return NextResponse.json({ error: "Faculty name is required" }, { status: 400 });
    }

    // Check if faculty already exists
    const existing = await sql/* sql */`
      SELECT id FROM public.tbl_faculties 
      WHERE LOWER(TRIM(faculty_name)) = LOWER(TRIM(${faculty_name.trim()}))
      LIMIT 1
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: "Faculty with this name already exists" }, { status: 409 });
    }

    const result = await sql/* sql */`
      INSERT INTO public.tbl_faculties (faculty_name)
      VALUES (${faculty_name.trim()})
      RETURNING id, faculty_name, created_at
    `;

    const newFaculty = Array.isArray(result) ? result[0] : result;
    return NextResponse.json({ 
      success: true, 
      faculty: newFaculty as { id: number; faculty_name: string; created_at: Date }
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating faculty:", error);
    const message = error instanceof Error ? error.message : "Failed to create faculty";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Update a faculty
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
    const { id, faculty_name } = body;

    // Handle id as number or string that can be converted to number
    const facultyId = id !== null && id !== undefined 
      ? (typeof id === "number" ? id : (typeof id === "string" && id.trim() !== "" ? Number(id) : null))
      : null;

    if (!facultyId || isNaN(facultyId)) {
      return NextResponse.json({ error: "Faculty ID is required" }, { status: 400 });
    }

    if (!faculty_name || typeof faculty_name !== "string" || !faculty_name.trim()) {
      return NextResponse.json({ error: "Faculty name is required" }, { status: 400 });
    }

    // Check if another faculty with the same name exists
    const existing = await sql/* sql */`
      SELECT id FROM public.tbl_faculties 
      WHERE LOWER(TRIM(faculty_name)) = LOWER(TRIM(${faculty_name.trim()})) 
        AND id != ${facultyId}
      LIMIT 1
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: "Another faculty with this name already exists" }, { status: 409 });
    }

    const result = await sql/* sql */`
      UPDATE public.tbl_faculties
      SET faculty_name = ${faculty_name.trim()}
      WHERE id = ${facultyId}
      RETURNING id, faculty_name, created_at
    `;

    const updated = Array.isArray(result) ? result[0] : result;
    if (!updated) {
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      faculty: updated as { id: number; faculty_name: string; created_at: Date }
    }, { status: 200 });
  } catch (error) {
    console.error("Error updating faculty:", error);
    const message = error instanceof Error ? error.message : "Failed to update faculty";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Delete a faculty
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
      return NextResponse.json({ error: "Valid faculty ID is required" }, { status: 400 });
    }

    const facultyId = Number(id);

    // Check if faculty has departments
    const departments = await sql/* sql */`
      SELECT COUNT(*) as count FROM public.tbl_departments 
      WHERE faculty_id = ${facultyId}
    `;

    const deptCount = Array.isArray(departments) && departments.length > 0 
      ? Number((departments[0] as { count: number | string | bigint }).count) 
      : 0;

    if (deptCount > 0) {
      return NextResponse.json({ 
        error: `Cannot delete faculty. It has ${deptCount} department(s) associated with it. Please delete or reassign departments first.` 
      }, { status: 409 });
    }

    const result = await sql/* sql */`
      DELETE FROM public.tbl_faculties
      WHERE id = ${facultyId}
      RETURNING id
    `;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting faculty:", error);
    const message = error instanceof Error ? error.message : "Failed to delete faculty";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

