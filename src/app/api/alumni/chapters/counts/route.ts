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
    
    // MATCH EXTERNAL API LOGIC: Start from alumni_chapter table, count rows where chapter1/2/3 matches
    // Total count = number of rows having at least one chapter filled (regardless of verification)
    // Verified count = rows where at least one chapter filled AND verified = 'true'
    // Base query structure - start from alumni_chapter
    const baseQueryFromChapter = sql`FROM public.alumni_chapter ac
      LEFT JOIN public.tbl_alumni a ON a.alumniid = ac.id`;
    
    // Build chapter filter - must have at least one chapter filled
    let chapterMembershipCondition = sql``;
    if (membershipFilter === "members") {
      chapterMembershipCondition = sql` AND (ac."chapter1" IS NOT NULL OR ac."chapter2" IS NOT NULL OR ac."chapter3" IS NOT NULL)`;
    } else if (membershipFilter === "non-members") {
      chapterMembershipCondition = sql` AND (ac."chapter1" IS NULL AND ac."chapter2" IS NULL AND ac."chapter3" IS NULL)`;
    }
    
    // Total count: Count ALL rows in alumni_chapter where at least one chapter matches (not just verified)
    const totalCountQuery = sql`
      SELECT COUNT(DISTINCT ac.id) as count
      ${baseQueryFromChapter}
      WHERE 1=1
      ${chapterFilterCondition}
      ${chapterMembershipCondition}
      ${chapterCountCondition}
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get all count (membershipFilter = "all", with verified filter)
    // Count ALL rows in alumni_chapter matching filters
    const allCountQuery = sql`
      SELECT COUNT(DISTINCT ac.id) as count
      ${baseQueryFromChapter}
      WHERE 1=1
      ${chapterFilterCondition}
      ${chapterCountCondition}
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get members count (membershipFilter = "members", with verified filter)
    // Count rows in alumni_chapter where at least one chapter is filled
    const membersCountQuery = sql`
      SELECT COUNT(DISTINCT ac.id) as count
      ${baseQueryFromChapter}
      WHERE 1=1
      ${chapterFilterCondition}
      AND (ac."chapter1" IS NOT NULL OR ac."chapter2" IS NOT NULL OR ac."chapter3" IS NOT NULL)
      ${chapterCountCondition}
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get non-members count (membershipFilter = "non-members", with verified filter)
    // Count rows in alumni_chapter where no chapters are filled
    const nonMembersCountQuery = sql`
      SELECT COUNT(DISTINCT ac.id) as count
      ${baseQueryFromChapter}
      WHERE 1=1
      ${chapterFilterCondition}
      AND (ac."chapter1" IS NULL AND ac."chapter2" IS NULL AND ac."chapter3" IS NULL)
      ${chapterCountCondition}
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get verified count (verified = true, with all other filters)
    // MATCH EXTERNAL API LOGIC EXACTLY: Count chapter memberships, not unique alumni
    // External API creates (alumni_id, chapter_id) pairs and counts verified per chapter
    // We need to count ALL verified chapter memberships (sum across all chapters)
    // Build chapter filter for each UNION branch - apply filter to the specific chapter column
    let chapter1Filter = sql``;
    let chapter2Filter = sql``;
    let chapter3Filter = sql``;
    if (allChapterIds.length > 0) {
      chapter1Filter = sql` AND ac.chapter1 = ANY(${allChapterIds})`;
      chapter2Filter = sql` AND ac.chapter2 = ANY(${allChapterIds})`;
      chapter3Filter = sql` AND ac.chapter3 = ANY(${allChapterIds})`;
    }
    
    // EXACT COPY OF EXTERNAL API LOGIC - use same COUNT method
    // External API: COUNT(DISTINCT CASE WHEN verify = 'true' THEN alumniid END) per chapter, then sums
    // We do the same but without GROUP BY to get total
    const verifiedCountQuery = sql`
      WITH chapter_members AS (
        SELECT DISTINCT ac.id as alumni_id, ac.chapter1 as chapter_id
        FROM public.alumni_chapter ac
        WHERE ac.chapter1 IS NOT NULL
        ${chapter1Filter}
        ${chapterMembershipCondition}
        ${chapterCountCondition}
        
        UNION
        
        SELECT DISTINCT ac.id as alumni_id, ac.chapter2 as chapter_id
        FROM public.alumni_chapter ac
        WHERE ac.chapter2 IS NOT NULL
        ${chapter2Filter}
        ${chapterMembershipCondition}
        ${chapterCountCondition}
        
        UNION
        
        SELECT DISTINCT ac.id as alumni_id, ac.chapter3 as chapter_id
        FROM public.alumni_chapter ac
        WHERE ac.chapter3 IS NOT NULL
        ${chapter3Filter}
        ${chapterMembershipCondition}
        ${chapterCountCondition}
      )
      SELECT 
        COUNT(DISTINCT CASE WHEN a.verify = ${'true'} THEN cm.alumni_id END) as count
      FROM chapter_members cm
      LEFT JOIN public.tbl_alumni a ON a.alumniid = cm.alumni_id
      WHERE 1=1
      ${accessFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
    `;
    
    // Get unverified count (verified = false, with all other filters)
    // Count rows in alumni_chapter where verified != 'true'
    const unverifiedCountQuery = sql`
      SELECT COUNT(DISTINCT ac.id) as count
      ${baseQueryFromChapter}
      WHERE 1=1
      ${chapterFilterCondition}
      ${chapterMembershipCondition}
      ${chapterCountCondition}
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
    console.log('[API] Verified count query executed. Filters:', {
      hasChapterFilter: allChapterIds.length > 0,
      chapterIds: allChapterIds,
      hasAccessFilter: accessFilter.hasFilter,
      hasFacultyFilter: selectedFaculties.length > 0,
      hasDeptFilter: selectedDepartments.length > 0,
    });
    
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
    console.error("[API] Error fetching alumni chapters counts:", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch counts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

