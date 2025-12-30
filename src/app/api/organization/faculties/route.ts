import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";

// GET /api/organization/faculties - Fetch all faculties
export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        id,
        faculty_name,
        created_at
      FROM public.tbl_faculties
      ORDER BY faculty_name ASC
    `;

    const faculties = rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      faculty_name: String(row.faculty_name || ""),
      created_at: row.created_at ? new Date(row.created_at as string) : new Date(),
    }));

    return NextResponse.json({ success: true, faculties }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch faculties";
    console.error("[API] Error fetching faculties:", msg, err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/organization/faculties - Create a new faculty
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { faculty_name } = body;

    if (!faculty_name || typeof faculty_name !== "string") {
      return NextResponse.json({ error: "Faculty name is required" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      INSERT INTO public.tbl_faculties (faculty_name)
      VALUES (${faculty_name.trim()})
      RETURNING id, faculty_name, created_at
    `;

    const faculty = {
      id: Number(rows[0].id),
      faculty_name: String(rows[0].faculty_name),
      created_at: new Date(rows[0].created_at as string),
    };

    return NextResponse.json({ success: true, faculty }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create faculty";
    console.error("[API] Error creating faculty:", msg, err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/organization/faculties - Update an existing faculty
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, faculty_name } = body;

    if (!id || !faculty_name || typeof faculty_name !== "string") {
      return NextResponse.json({ error: "ID and faculty name are required" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      UPDATE public.tbl_faculties
      SET faculty_name = ${faculty_name.trim()}
      WHERE id = ${Number(id)}
      RETURNING id, faculty_name, created_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }

    const faculty = {
      id: Number(rows[0].id),
      faculty_name: String(rows[0].faculty_name),
      created_at: new Date(rows[0].created_at as string),
    };

    return NextResponse.json({ success: true, faculty }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update faculty";
    console.error("[API] Error updating faculty:", msg, err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/organization/faculties - Delete a faculty
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Faculty ID is required" }, { status: 400 });
    }

    // Check if faculty is referenced by any departments
    const deptCheck = await sql/* sql */`
      SELECT COUNT(*) as count FROM public.tbl_departments WHERE faculty_id = ${Number(id)}
    `;

    if (Number(deptCheck[0].count) > 0) {
      return NextResponse.json({ 
        error: "Cannot delete faculty with associated departments" 
      }, { status: 400 });
    }

    // Check if faculty is referenced by any alumni
    const alumniCheck = await sql/* sql */`
      SELECT COUNT(*) as count FROM public.tbl_alumni WHERE faculty = ${Number(id)}
    `;

    if (Number(alumniCheck[0].count) > 0) {
      return NextResponse.json({ 
        error: "Cannot delete faculty with associated alumni records" 
      }, { status: 400 });
    }

    await sql/* sql */`
      DELETE FROM public.tbl_faculties WHERE id = ${Number(id)}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete faculty";
    console.error("[API] Error deleting faculty:", msg, err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
