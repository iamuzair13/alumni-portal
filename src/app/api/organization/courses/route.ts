import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/alumniProfile";
import { logAdminAction } from "@/lib/adminActivityLog";

// GET /api/organization/courses - Fetch all courses
export async function GET() {
  try {
    const rows = await sql/* sql */`
      SELECT 
        id,
        course_name,
        course_code
      FROM public.tbl_courses
      ORDER BY course_code ASC, course_name ASC
    `;

    const courses = rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      course_name: String(row.course_name || ""),
      course_code: row.course_code ? Number(row.course_code) : null,
    }));

    return NextResponse.json({ success: true, courses }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch courses";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/organization/courses - Create a new course
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { course_name, course_code } = body;

    if (!course_name || typeof course_name !== "string") {
      return NextResponse.json({ error: "Course name is required" }, { status: 400 });
    }

    if (course_code !== null && course_code !== undefined && (typeof course_code !== "number" || isNaN(course_code))) {
      return NextResponse.json({ error: "Course code must be a valid number" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      INSERT INTO public.tbl_courses (course_name, course_code)
      VALUES (${course_name.trim()}, ${course_code !== null && course_code !== undefined ? course_code : null})
      RETURNING id, course_name, course_code
    `;

    const course = {
      id: Number(rows[0].id),
      course_name: String(rows[0].course_name),
      course_code: rows[0].course_code ? Number(rows[0].course_code) : null,
    };

    await logAdminAction({ session, req, input: { action: "organization.course_create", entityType: "tbl_courses", entityId: Number(rows[0].id), success: true, metadata: { courseId: Number(rows[0].id), courseName: course_name.trim() } } });

    return NextResponse.json({ success: true, course }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create course";
    await logAdminAction({ session: null, req, input: { action: "organization.course_create", entityType: "tbl_courses", success: false, errorMessage: msg } }).catch(() => {});
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/organization/courses - Update an existing course
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, course_name, course_code } = body;

    if (!id || !course_name || typeof course_name !== "string") {
      return NextResponse.json({ error: "ID and course name are required" }, { status: 400 });
    }

    if (course_code !== null && course_code !== undefined && (typeof course_code !== "number" || isNaN(course_code))) {
      return NextResponse.json({ error: "Course code must be a valid number" }, { status: 400 });
    }

    const rows = await sql/* sql */`
      UPDATE public.tbl_courses
      SET course_name = ${course_name.trim()}, course_code = ${course_code !== null && course_code !== undefined ? course_code : null}
      WHERE id = ${Number(id)}
      RETURNING id, course_name, course_code
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const course = {
      id: Number(rows[0].id),
      course_name: String(rows[0].course_name),
      course_code: rows[0].course_code ? Number(rows[0].course_code) : null,
    };

    await logAdminAction({ session, req, input: { action: "organization.course_update", entityType: "tbl_courses", entityId: Number(rows[0].id), success: true, metadata: { courseId: Number(rows[0].id), courseName: course_name.trim() } } });

    return NextResponse.json({ success: true, course }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update course";
    await logAdminAction({ session: null, req, input: { action: "organization.course_update", entityType: "tbl_courses", success: false, errorMessage: msg } }).catch(() => {});
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/organization/courses - Delete a course
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdminUser(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
    }

    await sql/* sql */`
      DELETE FROM public.tbl_courses WHERE id = ${Number(id)}
    `;

    await logAdminAction({ session, req, input: { action: "organization.course_delete", entityType: "tbl_courses", entityId: Number(id), success: true, metadata: { courseId: Number(id) } } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete course";
    await logAdminAction({ session: null, req, input: { action: "organization.course_delete", entityType: "tbl_courses", success: false, errorMessage: msg } }).catch(() => {});
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}


