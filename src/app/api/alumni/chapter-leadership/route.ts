import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET() {
  try {
    const session = await auth();
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    const rows = await sql/* sql */`
      SELECT 
        a.alumniid,
        a.sapid,
        a.alumniname,
        a.departmentname,
        a.facultyname,
        a.degreetitle,
        a.personalemail,
        a.officialemail,
        a.universityemail,
        a.registrationno,
        cl.post,
        cl.created_at
      FROM public.tbl_alumni a
      JOIN public.chapter_leadership cl ON cl.id = a.chapter_leadership
      WHERE 1=1
        ${accessFilterCondition}
      ORDER BY cl.created_at DESC NULLS LAST, a.alumniid DESC`;
    
    const items = rows.map((r: Record<string, unknown>) => ({
      sapid: String(r.sapid ?? ""),
      registrationNo: r.registrationno ? String(r.registrationno) : null,
      name: String(r.alumniname ?? ""),
      department: r.departmentname ? String(r.departmentname) : null,
      faculty: r.facultyname ? String(r.facultyname) : null,
      program: r.degreetitle ? String(r.degreetitle) : null,
      email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null),
      post: r.post ? String(r.post) : null,
      createdAt: r.created_at,
    }));
    
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch chapter leadership";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userSapid = session?.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid) : null) : null;
    const userRegNo = session?.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno) : null) : null;
    if (!session?.user?.email && !userSapid && !userRegNo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { alumniId, post } = body;

    if (!alumniId) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    if (!post) {
      return NextResponse.json({ error: "Post is required" }, { status: 400 });
    }

    // Validate post
    const validPosts = ["president", "vicePresident", "coordinator"];
    if (!validPosts.includes(post)) {
      return NextResponse.json({ error: "Invalid post selected" }, { status: 400 });
    }

    // Map post values to display names
    const postDisplayNames: Record<string, string> = {
      president: "Chapter President",
      vicePresident: "Chapter Vice President",
      coordinator: "Chapter Coordinator",
    };

    const postDisplayName = postDisplayNames[post] || post;
    const alumniIdNum = Number(alumniId);
    if (isNaN(alumniIdNum) || alumniIdNum <= 0) {
      return NextResponse.json({ error: "Invalid alumni ID" }, { status: 400 });
    }

    // Check if alumni already has a pending application (by alumniid)
    const pendingApp = await sql/* sql */`
      SELECT id, status FROM public.chapter_leadership 
      WHERE alumniid = ${alumniIdNum} AND status = 'pending'
      LIMIT 1
    `;
    
    if (pendingApp && pendingApp.length > 0) {
      return NextResponse.json({ 
        error: "You already have a pending application. Please wait for admin approval." 
      }, { status: 400 });
    }

    // Check if alumni already has an approved leadership position
    const approvedApp = await sql/* sql */`
      SELECT cl.id, cl.status 
      FROM public.chapter_leadership cl
      INNER JOIN public.tbl_alumni a ON a.chapter_leadership = cl.id
      WHERE a.alumniid = ${alumniIdNum} AND cl.status = 'approved'
      LIMIT 1
    `;
    
    if (approvedApp && approvedApp.length > 0) {
      return NextResponse.json({ 
        error: "You are already approved as a leader. No further application is required." 
      }, { status: 400 });
    }

    // Also check if there's a rejected application that we should allow resubmission
    // (Optional: you might want to block resubmission of rejected apps too)

    // Insert new record with status='pending' (DO NOT link to tbl_alumni yet)
    // Store alumniid for reference (aligned with schema)
    // Use INSERT with ON CONFLICT to prevent duplicates (if unique constraint exists)
    const newChapterLeadership = await sql/* sql */`
      INSERT INTO public.chapter_leadership (post, created_at, status, updated_at, alumniid)
      VALUES (${postDisplayName}, NOW(), 'pending', NOW(), ${alumniIdNum})
      RETURNING id, status
    `;
    
    if (!newChapterLeadership || newChapterLeadership.length === 0) {
      throw new Error("Failed to create chapter leadership record");
    }
    
    const createdRecord = newChapterLeadership[0] as { id: number; status: string };

    // Verify the record was created with 'pending' status
    if (createdRecord.status !== 'pending') {

    }

    return NextResponse.json({ 
      success: true, 
      message: "Application submitted successfully. It is now pending admin approval." 
    });
  } catch (error) {

    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

