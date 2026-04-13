import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";

export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can export
    if (!canModify(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
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

    // Build access filter
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    // Build search condition
    let searchCondition = sql``;
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      searchCondition = sql` AND (
        LOWER(a.sapid) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.registrationno, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.alumniname, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.personalemail, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.officialemail, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.facultyname, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.departmentname, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(a.degreetitle, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(c1.national_chapter, c1.international_chapter, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(c2.national_chapter, c2.international_chapter, '')) LIKE ${searchTerm}
        OR LOWER(COALESCE(c3.national_chapter, c3.international_chapter, '')) LIKE ${searchTerm}
      )`;
    }

    // Build chapter filter conditions - get chapter IDs first
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
    if (allChapterIds.length > 0) {
      // Use ANY operator for array matching
      chapterFilterCondition = sql` AND (
        ac."chapter1" = ANY(${allChapterIds})
        OR ac."chapter2" = ANY(${allChapterIds})
        OR ac."chapter3" = ANY(${allChapterIds})
      )`;
    }
    
    // Helper function to combine OR conditions
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
    
    // Build faculty filter condition (case-insensitive with trim) - handle multiple
    let facultyFilterCondition = sql``;
    if (selectedFaculties.length > 0) {
      const normalizedFaculties = selectedFaculties.map(f => f.toLowerCase());
      const facultyConditions = normalizedFaculties.map(f => sql`LOWER(TRIM(COALESCE(a.facultyname, ''))) = ${f}`);
      if (facultyConditions.length === 1) {
        facultyFilterCondition = sql` AND ${facultyConditions[0]}`;
      } else if (facultyConditions.length > 1) {
        const combinedCondition = combineOrConditions(facultyConditions);
        facultyFilterCondition = sql` AND (${combinedCondition})`;
      }
    }
    
    // Build department filter condition (case-insensitive with trim) - handle multiple
    let departmentFilterCondition = sql``;
    if (selectedDepartments.length > 0) {
      const normalizedDepartments = selectedDepartments.map(d => d.toLowerCase());
      const departmentConditions = normalizedDepartments.map(d => sql`LOWER(TRIM(COALESCE(a.departmentname, ''))) = ${d}`);
      if (departmentConditions.length === 1) {
        departmentFilterCondition = sql` AND ${departmentConditions[0]}`;
      } else if (departmentConditions.length > 1) {
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
    const membershipJoinType: "JOIN" | "LEFT JOIN" = membershipFilter === "members" ? "JOIN" : "LEFT JOIN";
    let membershipWhereCondition = sql``;
    
    if (membershipFilter === "non-members") {
      // For non-members: must not have any chapter assigned
      membershipWhereCondition = sql` AND (ac.id IS NULL OR (ac.chapter1 IS NULL AND ac.chapter2 IS NULL AND ac.chapter3 IS NULL))`;
    } else if (membershipFilter === "members") {
      // For members: must have at least one chapter
      membershipWhereCondition = sql` AND ac.id IS NOT NULL AND (ac.chapter1 IS NOT NULL OR ac.chapter2 IS NOT NULL OR ac.chapter3 IS NOT NULL)`;
    }
    // For "all": no additional condition needed, just use LEFT JOIN
    
    // Chapter count filter - filter by exact number of chapters
    let chapterCountCondition = sql``;
    if (chapterCount !== undefined && chapterCount > 0) {
      // Count non-null chapters and match exactly
      chapterCountCondition = sql` AND (
        CASE 
          WHEN ac.chapter1 IS NOT NULL THEN 1 ELSE 0 END +
          CASE 
          WHEN ac.chapter2 IS NOT NULL THEN 1 ELSE 0 END +
          CASE 
          WHEN ac.chapter3 IS NOT NULL THEN 1 ELSE 0 END
        ) = ${chapterCount}
      `;
    }
    
    // Build the query based on membership filter
    const baseQuery = membershipJoinType === "JOIN"
      ? sql`FROM public.tbl_alumni a
      JOIN public.alumni_chapter ac ON ac.id = a.alumniid`
      : sql`FROM public.tbl_alumni a
      LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid`;

    // Fetch ALL fields from tbl_alumni with chapter data
    const query = sql/* sql */`
      SELECT 
        a.*,
        -- Chapter data
        ac.chapter1 as chapter1_id,
        ac.chapter2 as chapter2_id,
        ac.chapter3 as chapter3_id,
        ac.remarks as chapter_remarks,
        c1.national_chapter as chapter1_national,
        c1.international_chapter as chapter1_international,
        c2.national_chapter as chapter2_national,
        c2.international_chapter as chapter2_international,
        c3.national_chapter as chapter3_national,
        c3.international_chapter as chapter3_international,
        -- Association data
        assoc.id as association_id_value,
        assoc.faculty_name as association_title,
        NULL::text as association_description,
        NULL::text as association_dean,
        NULL::text as association_phone,
        NULL::text as association_email,
        NULL::text as association_address
      ${baseQuery}
      LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
      LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
      LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
      LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
      WHERE a.alumniid IS NOT NULL
        ${accessFilterCondition}
        ${searchCondition}
        ${chapterFilterCondition}
        ${facultyFilterCondition}
        ${departmentFilterCondition}
        ${verifiedFilterCondition}
        ${membershipWhereCondition}
        ${chapterCountCondition}
      ORDER BY a.alumniid DESC
    `;

    const rows = await query;
    
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export alumni chapters data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

