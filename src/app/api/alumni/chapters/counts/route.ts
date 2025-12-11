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
    
    // Determine join type based on membership filter
    const membershipJoinType: "JOIN" | "LEFT JOIN" = membershipFilter === "members" ? "JOIN" : "LEFT JOIN";
    let membershipWhereCondition = sql``;
    
    if (membershipFilter === "non-members") {
      membershipWhereCondition = sql` AND (ac.id IS NULL OR (ac."chapter1" IS NULL AND ac."chapter2" IS NULL AND ac."chapter3" IS NULL))`;
    } else if (membershipFilter === "members") {
      membershipWhereCondition = sql` AND ac.id IS NOT NULL AND (ac."chapter1" IS NOT NULL OR ac."chapter2" IS NOT NULL OR ac."chapter3" IS NOT NULL)`;
    }
    
    // Base query structure
    const baseQuery = membershipJoinType === "JOIN"
      ? sql`FROM public.tbl_alumni a
      JOIN public.alumni_chapter ac ON ac.id = a.alumniid`
      : sql`FROM public.tbl_alumni a
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid`;
    
    // Get total count (with all filters except membership and verified)
    const totalCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQuery}
      WHERE 1=1
      ${accessFilterCondition}
      ${chapterFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get all count (membershipFilter = "all", with verified filter)
    const allCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      FROM public.tbl_alumni a
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      WHERE 1=1
      ${accessFilterCondition}
      ${chapterFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
    `;
    
    // Get members count (membershipFilter = "members", with verified filter)
    const membersCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      FROM public.tbl_alumni a
      JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      WHERE 1=1
      ${accessFilterCondition}
      ${chapterFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
      AND ac.id IS NOT NULL AND (ac."chapter1" IS NOT NULL OR ac."chapter2" IS NOT NULL OR ac."chapter3" IS NOT NULL)
    `;
    
    // Get non-members count (membershipFilter = "non-members", with verified filter)
    const nonMembersCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      FROM public.tbl_alumni a
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
      WHERE 1=1
      ${accessFilterCondition}
      ${chapterFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${verifiedFilterCondition}
      AND (ac.id IS NULL OR (ac."chapter1" IS NULL AND ac."chapter2" IS NULL AND ac."chapter3" IS NULL))
    `;
    
    // Get verified count (verified = true, with all other filters)
    const verifiedCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQuery}
      WHERE 1=1
      ${accessFilterCondition}
      ${chapterFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${membershipWhereCondition}
      AND a.verify = 'true'
    `;
    
    // Get unverified count (verified = false, with all other filters)
    const unverifiedCountQuery = sql`
      SELECT COUNT(DISTINCT a.alumniid) as count
      ${baseQuery}
      WHERE 1=1
      ${accessFilterCondition}
      ${chapterFilterCondition}
      ${facultyFilterCondition}
      ${departmentFilterCondition}
      ${membershipWhereCondition}
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

