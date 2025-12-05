import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { sendChaptersApplicationEmail } from "@/lib/email";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    
    // Get filter parameters
    const nationalChapter = searchParams.get("nationalChapter");
    const internationalChapter = searchParams.get("internationalChapter");
    const faculty = searchParams.get("faculty");
    const department = searchParams.get("department");
    const verified = searchParams.get("verified");
    const membershipFilter = searchParams.get("membershipFilter") || "members"; // "all", "members", "non-members"
    
    // Debug logging
    console.log("[API] Alumni Chapters Filters:", {
      nationalChapter: nationalChapter || "none",
      internationalChapter: internationalChapter || "none",
      faculty: faculty || "none",
      department: department || "none",
      verified: verified || "none",
      membershipFilter,
    });
    
    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    // Build chapter filter conditions
    // First, get chapter IDs from chapter names if provided
    let nationalChapterId: number | null = null;
    let internationalChapterId: number | null = null;
    
    if (nationalChapter && nationalChapter.trim()) {
      const chapterRows = await sql/* sql */`
        SELECT id FROM public.tblchapters 
        WHERE LOWER(TRIM(COALESCE(national_chapter, ''))) = LOWER(${nationalChapter.trim()})
        AND is_active = true
        LIMIT 1
      `;
      if (chapterRows[0]) {
        nationalChapterId = Number((chapterRows[0] as { id: number }).id);
      }
    }
    
    if (internationalChapter && internationalChapter.trim()) {
      const chapterRows = await sql/* sql */`
        SELECT id FROM public.tblchapters 
        WHERE LOWER(TRIM(COALESCE(international_chapter, ''))) = LOWER(${internationalChapter.trim()})
        AND is_active = true
        LIMIT 1
      `;
      if (chapterRows[0]) {
        internationalChapterId = Number((chapterRows[0] as { id: number }).id);
      }
    }
    
    let chapterFilterCondition = sql``;
    if (nationalChapterId !== null && internationalChapterId !== null) {
      // If both are selected, use OR (alumni with either chapter)
      chapterFilterCondition = sql` AND (
        (ac."chapter1" = ${nationalChapterId} OR ac."chapter2" = ${nationalChapterId} OR ac."chapter3" = ${nationalChapterId})
        OR
        (ac."chapter1" = ${internationalChapterId} OR ac."chapter2" = ${internationalChapterId} OR ac."chapter3" = ${internationalChapterId})
      )`;
    } else if (nationalChapterId !== null) {
      chapterFilterCondition = sql` AND (ac."chapter1" = ${nationalChapterId} OR ac."chapter2" = ${nationalChapterId} OR ac."chapter3" = ${nationalChapterId})`;
    } else if (internationalChapterId !== null) {
      chapterFilterCondition = sql` AND (ac."chapter1" = ${internationalChapterId} OR ac."chapter2" = ${internationalChapterId} OR ac."chapter3" = ${internationalChapterId})`;
    }
    
    console.log("[API] Chapter filter IDs:", {
      nationalChapterId,
      internationalChapterId,
      hasNationalFilter: nationalChapterId !== null,
      hasInternationalFilter: internationalChapterId !== null,
    });
    
    // Build faculty filter condition (case-insensitive with trim)
    let facultyFilterCondition = sql``;
    if (faculty && faculty.trim()) {
      const facultyValue = faculty.trim();
      facultyFilterCondition = sql` AND LOWER(TRIM(COALESCE(a.facultyname, ''))) = LOWER(${facultyValue})`;
    }
    
    // Build department filter condition (case-insensitive with trim)
    let departmentFilterCondition = sql``;
    if (department && department.trim()) {
      const departmentValue = department.trim();
      departmentFilterCondition = sql` AND LOWER(TRIM(COALESCE(a.departmentname, ''))) = LOWER(${departmentValue})`;
    }
    
    // Build verified filter condition
    let verifiedFilterCondition = sql``;
    if (verified === "true") {
      verifiedFilterCondition = sql` AND LOWER(TRIM(COALESCE(a.verify, ''))) = 'true'`;
    }
    
    // Build membership filter condition
    const membershipJoinType: "JOIN" | "LEFT JOIN" = membershipFilter === "members" ? "JOIN" : "LEFT JOIN";
    let membershipWhereCondition = sql``;
    
    if (membershipFilter === "non-members") {
      // For non-members: must not have any chapter assigned
      membershipWhereCondition = sql` AND (ac.id IS NULL OR (ac."chapter1" IS NULL AND ac."chapter2" IS NULL AND ac."chapter3" IS NULL))`;
    } else if (membershipFilter === "members") {
      // For members: must have at least one chapter
      membershipWhereCondition = sql` AND ac.id IS NOT NULL AND (ac."chapter1" IS NOT NULL OR ac."chapter2" IS NOT NULL OR ac."chapter3" IS NOT NULL)`;
    }
    // For "all": no additional condition needed, just use LEFT JOIN
    
    // Build the query based on membership filter
    const baseQuery = membershipJoinType === "JOIN"
      ? sql`FROM public.tbl_alumni a
      JOIN public.alumni_chapter ac ON ac.id = a.alumniid`
      : sql`FROM public.tbl_alumni a
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid`;
    
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
        ac."chapter1",
        ac."chapter2",
        ac."chapter3",
        c1.national_chapter as chapter1_national,
        c1.international_chapter as chapter1_international,
        c2.national_chapter as chapter2_national,
        c2.international_chapter as chapter2_international,
        c3.national_chapter as chapter3_national,
        c3.international_chapter as chapter3_international,
        COALESCE(c1.national_chapter, c1.international_chapter) as chapter1_name,
        COALESCE(c2.national_chapter, c2.international_chapter) as chapter2_name,
        COALESCE(c3.national_chapter, c3.international_chapter) as chapter3_name
      ${baseQuery}
      LEFT JOIN public.tblchapters c1 ON c1.id = ac."chapter1"
      LEFT JOIN public.tblchapters c2 ON c2.id = ac."chapter2"
      LEFT JOIN public.tblchapters c3 ON c3.id = ac."chapter3"
      WHERE 1=1
        ${accessFilterCondition}
        ${chapterFilterCondition}
        ${facultyFilterCondition}
        ${departmentFilterCondition}
        ${verifiedFilterCondition}
        ${membershipWhereCondition}
      ORDER BY a.alumniid DESC`;
    
    console.log("[API] Alumni Chapters Query Result:", {
      rowCount: rows.length,
      sampleFaculties: rows.slice(0, 5).map((r: Record<string, unknown>) => r.facultyname),
    });
    
    const items = rows.map((r: Record<string, unknown>) => {
      const chapters: string[] = [];
      if (r.chapter1_name) chapters.push(String(r.chapter1_name));
      if (r.chapter2_name) chapters.push(String(r.chapter2_name));
      if (r.chapter3_name) chapters.push(String(r.chapter3_name));
      
      return {
        sapid: String(r.sapid ?? ""),
        registrationNo: r.registrationno ? String(r.registrationno) : null,
        name: String(r.alumniname ?? ""),
        department: r.departmentname ? String(r.departmentname) : null,
        faculty: r.facultyname ? String(r.facultyname) : null,
        program: r.degreetitle ? String(r.degreetitle) : null,
        email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null),
        chapters,
      };
    });
    
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch chapters";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    const { alumniId, chapters, contactNumber, remarks } = body;

    if (!alumniId) {
      return NextResponse.json({ error: "Alumni ID is required" }, { status: 400 });
    }

    // SECURITY: Authorization check
    // - Admins/superadmins can modify any alumni's chapter assignments
    // - Alumni can only modify their own chapter assignments
    const { canModify } = await import("@/lib/alumniProfile");
    const isAdminOrSuperAdmin = canModify(session.user);
    
    if (!isAdminOrSuperAdmin) {
      // For non-admin users, verify they are modifying their own record
      // Get the user's alumni ID from session (SAP ID or email lookup)
      let userAlumniId: number | null = null;
      
      // Try to get SAP ID or registration number from session
      const sessionSapid = session.user ? ((session.user as { sapid?: string | null })?.sapid ? String((session.user as { sapid?: string | null }).sapid).trim() : undefined) : undefined;
      const sessionRegNo = session.user ? ((session.user as { registrationno?: string | null })?.registrationno ? String((session.user as { registrationno?: string | null }).registrationno).trim() : undefined) : undefined;
      
      if (sessionSapid) {
        const sapRows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE sapid = ${sessionSapid} 
          LIMIT 1
        `;
        if (sapRows[0]) {
          userAlumniId = Number((sapRows[0] as { alumniid: number }).alumniid);
        }
      } else if (sessionRegNo) {
        const regRows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE registrationno = ${sessionRegNo} 
          LIMIT 1
        `;
        if (regRows[0]) {
          userAlumniId = Number((regRows[0] as { alumniid: number }).alumniid);
        }
      }
      
      // Fallback to email lookup if SAP ID not found
      if (userAlumniId === null && session.user?.email) {
        const email = String(session.user.email);
        const emailRows = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
          ORDER BY alumniid DESC 
          LIMIT 1
        `;
        if (emailRows[0]) {
          userAlumniId = Number((emailRows[0] as { alumniid: number }).alumniid);
        }
      }
      
      // Verify that the requested alumniId matches the user's own alumni ID
      if (userAlumniId === null || userAlumniId !== Number(alumniId)) {
        return NextResponse.json({ error: "Forbidden: You can only modify your own chapter assignments" }, { status: 403 });
      }
    }

    // Validate that at least one chapter is selected
    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json(
        { error: "At least one chapter must be selected" },
        { status: 400 }
      );
    }

    // Validate maximum 3 chapters
    if (chapters.length > 3) {
      return NextResponse.json(
        { error: "You can select up to 3 chapters only" },
        { status: 400 }
      );
    }

    // Extract chapters (up to 3) - convert to numeric IDs
    const chapter1 = chapters[0] ? Number(chapters[0]) : null;
    const chapter2 = chapters[1] ? Number(chapters[1]) : null;
    const chapter3 = chapters[2] ? Number(chapters[2]) : null;
    
    // Extract and clean remarks
    const remarksText = remarks ? String(remarks).trim().slice(0, 5000) : null; // Limit to 5000 characters
    
    // Validate that all chapter IDs are valid numbers
    if (chapter1 !== null && (isNaN(chapter1) || chapter1 <= 0)) {
      return NextResponse.json(
        { error: "Invalid chapter ID provided" },
        { status: 400 }
      );
    }
    if (chapter2 !== null && (isNaN(chapter2) || chapter2 <= 0)) {
      return NextResponse.json(
        { error: "Invalid chapter ID provided" },
        { status: 400 }
      );
    }
    if (chapter3 !== null && (isNaN(chapter3) || chapter3 <= 0)) {
      return NextResponse.json(
        { error: "Invalid chapter ID provided" },
        { status: 400 }
      );
    }
    
    // SECURITY: Check access filter for admin/viewer users only
    // (Alumni users have already been verified to own the record above)
    if (isAdminOrSuperAdmin) {
      const { buildAccessFilterSQL } = await import("@/lib/userAccess");
      const accessFilter = await buildAccessFilterSQL(session, "");
      
      if (accessFilter.hasFilter && accessFilter.sql) {
        const accessCheck = await sql/* sql */`
          SELECT alumniid FROM public.tbl_alumni 
          WHERE alumniid = ${alumniId} 
          AND (${accessFilter.sql})
          LIMIT 1
        `;
        
        if (!accessCheck[0]) {
          return NextResponse.json({ error: "Forbidden: You don't have access to this alumni record" }, { status: 403 });
        }
      }
    }

    // Check if a record already exists for this alumni
    const existingRecord = await sql/* sql */`
      SELECT id FROM public.alumni_chapter 
      WHERE id = ${alumniId}
    `;

    if (existingRecord.length > 0) {
      // Update existing record
      // Using quoted identifiers to handle spaces/hyphens in column names
      await sql/* sql */`
        UPDATE public.alumni_chapter 
        SET 
          "chapter1" = ${chapter1},
          "chapter2" = ${chapter2},
          "chapter3" = ${chapter3},
          remarks = ${remarksText}
        WHERE id = ${alumniId}
      `;
    } else {
      // Insert new record
      // Using quoted identifiers to handle spaces/hyphens in column names
      await sql/* sql */`
        INSERT INTO public.alumni_chapter (id, "chapter1", "chapter2", "chapter3", remarks)
        VALUES (${alumniId}, ${chapter1}, ${chapter2}, ${chapter3}, ${remarksText})
      `;
    }

    // Update contact number in tbl_alumni if provided
    if (contactNumber) {
      await sql/* sql */`
        UPDATE public.tbl_alumni 
        SET contactno = ${contactNumber}
        WHERE alumniid = ${alumniId}
      `;
    }

    // Send confirmation email
    try {
      const alumniRows = await sql/* sql */`
        SELECT alumniname, personalemail, officialemail, universityemail
        FROM public.tbl_alumni 
        WHERE alumniid = ${alumniId}
        LIMIT 1
      `;
      const alumni = alumniRows[0] as {
        alumniname: string | null;
        personalemail: string | null;
        officialemail: string | null;
        universityemail: string | null;
      } | undefined;
      
      if (alumni) {
        const alumniEmail = alumni.personalemail || alumni.officialemail || alumni.universityemail;
        const alumniName = alumni.alumniname || "Alumni";
        
        if (alumniEmail) {
          // Fetch chapter names from tblchapters using the chapter IDs
          const chapterIds = [chapter1, chapter2, chapter3].filter((id): id is number => id !== null);
          
          if (chapterIds.length > 0) {
            // Query each chapter individually to get names
            const chapterNames: string[] = [];
            
            for (const chapterId of chapterIds) {
              try {
                const chapterRows = await sql/* sql */`
                  SELECT COALESCE(national_chapter, international_chapter) as chapter_name
                  FROM public.tblchapters
                  WHERE id = ${chapterId}
                  LIMIT 1
                `;
                
                const chapter = chapterRows[0] as { chapter_name: string | null } | undefined;
                if (chapter?.chapter_name) {
                  chapterNames.push(chapter.chapter_name);
                }
              } catch (err) {
                console.error(`[API] Failed to fetch chapter name for ID ${chapterId}:`, err);
              }
            }
            
            // Send email asynchronously (don't wait for it to complete)
            if (chapterNames.length > 0) {
              sendChaptersApplicationEmail(alumniEmail, alumniName, chapterNames).catch((err) => {
                console.error("[API] Failed to send chapters application email:", err);
              });
            }
          }
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error("[API] Error sending chapters application email:", emailError);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Application submitted successfully" 
    });
  } catch (error) {
    console.error("Error submitting alumni chapters application:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

