import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
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
    const membershipFilter = searchParams.get("membershipFilter") || "members";
    const chapterCountParam = searchParams.get("chapterCount");
    const chapterCount = chapterCountParam ? Number(chapterCountParam) : undefined;
    
    const selectedNationalChapters = nationalChaptersParam ? nationalChaptersParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedInternationalChapters = internationalChaptersParam ? internationalChaptersParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedFaculties = facultiesParam ? facultiesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const selectedDepartments = departmentsParam ? departmentsParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    
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
    
    const allChapterIds = [...nationalChapterIds, ...internationalChapterIds];
    
    let chapterFilterCondition = sql``;
    if (allChapterIds.length > 0) {
      chapterFilterCondition = sql` AND (
        ac."chapter1" = ANY(${allChapterIds}) OR 
        ac."chapter2" = ANY(${allChapterIds}) OR 
        ac."chapter3" = ANY(${allChapterIds})
      )`;
    }
    
    // Build faculty filter condition (case-insensitive with trim) - handle multiple
    let facultyFilterCondition = sql``;
    if (selectedFaculties.length > 0) {
      const normalizedFaculties = selectedFaculties.map(f => f.toLowerCase());
      facultyFilterCondition = sql` AND LOWER(TRIM(COALESCE(a.facultyname, ''))) = ANY(${normalizedFaculties})`;
    }
    
    // Build department filter condition (case-insensitive with trim) - handle multiple
    let departmentFilterCondition = sql``;
    if (selectedDepartments.length > 0) {
      const normalizedDepartments = selectedDepartments.map(d => d.toLowerCase());
      departmentFilterCondition = sql` AND LOWER(TRIM(COALESCE(a.departmentname, ''))) = ANY(${normalizedDepartments})`;
    }
    
    // Build verified filter condition
    let verifiedFilterCondition = sql``;
    if (verified === "true") {
      verifiedFilterCondition = sql` AND a.verify = 'true'`;
    } else if (verified === "false") {
      verifiedFilterCondition = sql` AND (a.verify IS NULL OR a.verify = '' OR a.verify != 'true')`;
    }
    
    // Chapter count filter - filter by exact number of chapters
    let chapterCountCondition = sql``;
    if (chapterCount !== undefined && chapterCount > 0) {
      // Count non-null chapters and match exactly
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
    
    // Base query: start from tbl_alumni and LEFT JOIN alumni_chapter to include ALL alumni,
    // including those without any chapter membership (ac.* will be NULL for non-members).
    const baseQueryFromAlumni = sql`FROM public.tbl_alumni a
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid`;
    
    // Helper conditions for membership:
    // Members = alumni who have a row in alumni_chapter (ac.id IS NOT NULL)
    // Non-members = alumni who do NOT have a row in alumni_chapter (ac.id IS NULL)
    const membersCondition = sql` AND ac.id IS NOT NULL`;
    const nonMembersCondition = sql` AND ac.id IS NULL`;
    
    // Total count: Count ALL alumni (with or without chapters), under current filters
    const totalCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get all count: same as total (kept separate for backward compatibility)
    const allCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get members count: count TOTAL chapter memberships (an alumni with 2 or 3 chapters is counted 2 or 3 times)
    // We do this by summing non-null chapter slots for all matching alumni that have a row in alumni_chapter.
    const membersCountQuery = sql`
      SELECT COALESCE(SUM(
        -- If no chapters are set but the alumni has a row in alumni_chapter,
        -- treat it as 1 membership (to match the list, which shows one row for them).
        CASE 
          WHEN ac."chapter1" IS NULL AND ac."chapter2" IS NULL AND ac."chapter3" IS NULL THEN 1
          ELSE
            (CASE WHEN ac."chapter1" IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN ac."chapter2" IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN ac."chapter3" IS NOT NULL THEN 1 ELSE 0 END)
        END
      ), 0) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${chapterFilterCondition}
      ${chapterCountCondition}
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
      ${membersCondition}
    `;
    
    // Get non-members count: alumni who do NOT have a row in alumni_chapter table
    const nonMembersCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
      ${nonMembersCondition}
    `;
    
    // Get verified count: all verified alumni (regardless of chapter membership)
    // Verified count: alumni with verify = 'true'
    const verifiedCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      AND LOWER(TRIM(COALESCE(a.verify, ''))) = 'true'
    `;
    
    // Unverified count: alumni where verify is NULL/empty or not 'true'
    const unverifiedCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQueryFromAlumni}
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      AND (a.verify IS NULL OR a.verify = '' OR a.verify != 'true')
    `;
    
    // Execute all queries in parallel
    const [totalResult, allResult, membersResult, nonMembersResult, verifiedResult, unverifiedResult] = await Promise.all([
      totalCountQuery,
      allCountQuery,
      membersCountQuery,
      nonMembersCountQuery,
      verifiedCountQuery,
      unverifiedCountQuery,
    ]);
    
    // Debug: Log verified count query details

    const total = Number((totalResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    const all = Number((allResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    const members = Number((membersResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    const nonMembers = Number((nonMembersResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    const verifiedCount = Number((verifiedResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    const unverifiedCount = Number((unverifiedResult as unknown as Array<{ count: bigint }>)[0]?.count || 0);
    
    return NextResponse.json({
      total,
      all,
      members,
      nonMembers,
      verified: verifiedCount,
      unverified: unverifiedCount,
    }, { status: 200 });
  } catch (err) {

    const msg = err instanceof Error ? err.message : "Failed to fetch counts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

