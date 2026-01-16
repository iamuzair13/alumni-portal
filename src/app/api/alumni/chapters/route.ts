import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { sendChaptersApplicationEmail } from "@/lib/email";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    
    // Get filter parameters (arrays for multi-select)
    const nationalChaptersParam = searchParams.get("nationalChapters");
    const internationalChaptersParam = searchParams.get("internationalChapters");
    const facultiesParam = searchParams.get("faculties");
    const departmentsParam = searchParams.get("departments");
    const verified = searchParams.get("verified");
    const membershipFilter = searchParams.get("membershipFilter") || "members"; // "all", "members", "non-members"
    const chapterCountParam = searchParams.get("chapterCount"); // "1", "2", "3", etc.
    const chapterCount = chapterCountParam ? Number(chapterCountParam) : undefined;
    
    const selectedNationalChapters = nationalChaptersParam ? nationalChaptersParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedInternationalChapters = internationalChaptersParam ? internationalChaptersParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedFaculties = facultiesParam ? facultiesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedDepartments = departmentsParam ? departmentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    // Debug logging

    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    // Build chapter filter conditions
    // Get chapter IDs from chapter names if provided
    const nationalChapterIds: number[] = [];
    const internationalChapterIds: number[] = [];
    
    if (selectedNationalChapters.length > 0) {
      for (const chapterName of selectedNationalChapters) {
        const chapterRows = await sql/* sql */`
          SELECT id FROM public.tblchapters 
          WHERE LOWER(TRIM(COALESCE(national_chapter, ''))) = LOWER(${chapterName})
          AND is_active = true
          LIMIT 1
        `;
        if (chapterRows[0]) {
          nationalChapterIds.push(Number((chapterRows[0] as { id: number }).id));
        }
      }
    }
    
    if (selectedInternationalChapters.length > 0) {
      for (const chapterName of selectedInternationalChapters) {
        const chapterRows = await sql/* sql */`
          SELECT id FROM public.tblchapters 
          WHERE LOWER(TRIM(COALESCE(international_chapter, ''))) = LOWER(${chapterName})
          AND is_active = true
          LIMIT 1
        `;
        if (chapterRows[0]) {
          internationalChapterIds.push(Number((chapterRows[0] as { id: number }).id));
        }
      }
    }
    
    let chapterFilterCondition = sql``;
    const allChapterIds = [...nationalChapterIds, ...internationalChapterIds];
    
    // If chapters are selected but no matching IDs found, return empty result
    if ((selectedNationalChapters.length > 0 || selectedInternationalChapters.length > 0) && allChapterIds.length === 0) {
      // Return empty result set if filters are selected but no matching chapter IDs found
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    
    if (allChapterIds.length > 0) {
      // Use OR to match any of the selected chapters
      // Build IN clause by passing array directly to postgres
      chapterFilterCondition = sql` AND (
        ac."chapter1" = ANY(${allChapterIds})
        OR ac."chapter2" = ANY(${allChapterIds})
        OR ac."chapter3" = ANY(${allChapterIds})
      )`;
    }

    // Build faculty filter condition (case-insensitive with trim) - handle multiple
    // Check both joined table value and fallback text column
    let facultyFilterCondition = sql``;
    if (selectedFaculties.length > 0) {
      const normalizedFaculties = selectedFaculties.map(f => f.toLowerCase());
      // Build OR conditions for multiple faculties (similar to alumni route)
      // Check both f.faculty_name (from joined table) and a.facultyname (fallback)
      const facultyConditions = normalizedFaculties.map(f => sql`LOWER(TRIM(COALESCE(f.faculty_name, a.facultyname, ''))) = ${f}`);
      if (facultyConditions.length === 1) {
        facultyFilterCondition = sql` AND ${facultyConditions[0]}`;
      } else if (facultyConditions.length > 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const combineOrConditions = (conditions: any[]): any => {
          if (conditions.length === 0) return sql``;
          if (conditions.length === 1) return conditions[0];
          if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
          const mid = Math.ceil(conditions.length / 2);
          const left = combineOrConditions(conditions.slice(0, mid));
          const right = combineOrConditions(conditions.slice(mid));
          return sql`${left} OR ${right}`;
        };
        const combinedCondition = combineOrConditions(facultyConditions);
        facultyFilterCondition = sql` AND (${combinedCondition})`;
      }

    }
    
    // Build department filter condition (case-insensitive with trim) - handle multiple
    // Check both joined table value and fallback text column
    let departmentFilterCondition = sql``;
    if (selectedDepartments.length > 0) {
      const normalizedDepartments = selectedDepartments.map(d => d.toLowerCase());
      // Build OR conditions for multiple departments (similar to alumni route)
      // Check both d.department_name (from joined table) and a.departmentname (fallback)
      const departmentConditions = normalizedDepartments.map(d => sql`LOWER(TRIM(COALESCE(d.department_name, a.departmentname, ''))) = ${d}`);
      if (departmentConditions.length === 1) {
        departmentFilterCondition = sql` AND ${departmentConditions[0]}`;
      } else if (departmentConditions.length > 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const combineOrConditions = (conditions: any[]): any => {
          if (conditions.length === 0) return sql``;
          if (conditions.length === 1) return conditions[0];
          if (conditions.length === 2) return sql`${conditions[0]} OR ${conditions[1]}`;
          const mid = Math.ceil(conditions.length / 2);
          const left = combineOrConditions(conditions.slice(0, mid));
          const right = combineOrConditions(conditions.slice(mid));
          return sql`${left} OR ${right}`;
        };
        const combinedCondition = combineOrConditions(departmentConditions);
        departmentFilterCondition = sql` AND (${combinedCondition})`;
      }

    }
    
    // Build verified filter condition
    let verifiedFilterCondition = sql``;
    if (verified === "true") {
      verifiedFilterCondition = sql` AND LOWER(TRIM(COALESCE(a.verify, ''))) = 'true'`;
    }
    
    // Build membership filter condition
    // Members = alumni who have a row in alumni_chapter (ac.id IS NOT NULL)
    // Non-members = alumni who do NOT have a row in alumni_chapter (ac.id IS NULL)
    const membershipJoinType: "JOIN" | "LEFT JOIN" = membershipFilter === "members" ? "JOIN" : "LEFT JOIN";
    let membershipWhereCondition = sql``;
    
    if (membershipFilter === "non-members") {
      // For non-members: must NOT have a row in alumni_chapter table
      membershipWhereCondition = sql` AND ac.id IS NULL`;
    } else if (membershipFilter === "members") {
      // For members: must have a row in alumni_chapter table
      membershipWhereCondition = sql` AND ac.id IS NOT NULL`;
    }
    // For "all": no additional condition needed, just use LEFT JOIN
    
    // Chapter count filter - filter by exact number of chapters
    let chapterCountCondition = sql``;
    if (chapterCount !== undefined && chapterCount > 0) {
      // Count non-null chapters and match exactly
      // Using CASE to count non-null chapters
      chapterCountCondition = sql` AND (
        CASE 
          WHEN ac."chapter1" IS NOT NULL THEN 1 ELSE 0 END +
          CASE 
          WHEN ac."chapter2" IS NOT NULL THEN 1 ELSE 0 END +
          CASE 
          WHEN ac."chapter3" IS NOT NULL THEN 1 ELSE 0 END
        ) = ${chapterCount}
      `;
    }
    
    // Build the query based on membership filter
    const baseQuery = membershipJoinType === "JOIN"
      ? sql`FROM public.tbl_alumni a
      JOIN public.alumni_chapter ac ON ac.id = a.alumniid`
      : sql`FROM public.tbl_alumni a
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid`;

    let rows;
    try {
      rows = await sql/* sql */`
        SELECT 
          a.alumniid,
          a.sapid,
          a.alumniname,
          COALESCE(d.department_name, a.departmentname) as departmentname,
          COALESCE(f.faculty_name, a.facultyname) as facultyname,
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
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
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
          ${chapterCountCondition}
        ORDER BY a.alumniid DESC`;
    } catch (queryError) {

      throw queryError;
    }

    // Build items such that each chapter membership is treated as a separate row.
    // If an alumni is member of 2 or 3 chapters, they will appear 2 or 3 times in the list.
    const items: Array<{
      sapid: string;
      registrationNo: string | null;
      name: string;
      department: string | null;
      faculty: string | null;
      program: string | null;
      email: string | null;
      chapters: string[];
    }> = [];

    (rows as Record<string, unknown>[]).forEach((r) => {
      const base = {
        sapid: String(r.sapid ?? ""),
        registrationNo: r.registrationno ? String(r.registrationno) : null,
        name: String(r.alumniname ?? ""),
        department: r.departmentname ? String(r.departmentname) : null,
        faculty: r.facultyname ? String(r.facultyname) : null,
        program: r.degreetitle ? String(r.degreetitle) : null,
        email:
          (r.personalemail ? String(r.personalemail) : null) ||
          (r.officialemail ? String(r.officialemail) : null) ||
          (r.universityemail ? String(r.universityemail) : null),
      };

      const chapter1 = r.chapter1_name ? String(r.chapter1_name) : null;
      const chapter2 = r.chapter2_name ? String(r.chapter2_name) : null;
      const chapter3 = r.chapter3_name ? String(r.chapter3_name) : null;

      // For each non-null chapter, push a separate item with a single-element chapters array
      if (chapter1) {
        items.push({
          ...base,
          chapters: [chapter1],
        });
      }
      if (chapter2) {
        items.push({
          ...base,
          chapters: [chapter2],
        });
      }
      if (chapter3) {
        items.push({
          ...base,
          chapters: [chapter3],
        });
      }

      // For alumni with no chapters (e.g., non-members in "all" or explicit non-members view),
      // ensure they still appear once with an empty chapters array.
      if (!chapter1 && !chapter2 && !chapter3) {
        items.push({
          ...base,
          chapters: [],
        });
      }
    });
    
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {

    const msg = err instanceof Error ? err.message : "Failed to fetch chapters";
    const errorDetails = err instanceof Error ? err.stack : String(err);

    return NextResponse.json({ error: msg, details: process.env.NODE_ENV === "development" ? errorDetails : undefined }, { status: 500 });
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

              }
            }
            
            // Send email asynchronously (don't wait for it to complete)
            if (chapterNames.length > 0) {
              sendChaptersApplicationEmail(alumniEmail, alumniName, chapterNames).catch((err) => {

              });
            }
          }
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails

    }

    return NextResponse.json({ 
      success: true, 
      message: "Application submitted successfully" 
    });
  } catch (error) {

    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

