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
    if (!session?.user?.email && !userSapid) {
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

    // Check if chapter_leadership already exists for this alumni
    const alumniRecord = await sql/* sql */`
      SELECT chapter_leadership FROM public.tbl_alumni 
      WHERE alumniid = ${alumniId}
      LIMIT 1
    `;

    const existingChapterLeadershipId = alumniRecord[0]?.chapter_leadership;

    if (existingChapterLeadershipId) {
      // Update existing record in chapter_leadership
      await sql/* sql */`
        UPDATE public.chapter_leadership 
        SET post = ${postDisplayName},
            created_at = NOW()
        WHERE id = ${existingChapterLeadershipId}
      `;
    } else {
      // Insert new record into chapter_leadership
      const newChapterLeadership = await sql/* sql */`
        INSERT INTO public.chapter_leadership (post, created_at)
        VALUES (${postDisplayName}, NOW())
        RETURNING id
      `;
      
      const newChapterLeadershipId = newChapterLeadership[0]?.id;
      
      if (newChapterLeadershipId) {
        // Update tbl_alumni to link to the new chapter_leadership record
        await sql/* sql */`
          UPDATE public.tbl_alumni 
          SET chapter_leadership = ${newChapterLeadershipId}
          WHERE alumniid = ${alumniId}
        `;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Application submitted successfully" 
    });
  } catch (error) {
    console.error("Error submitting chapter leadership application:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

