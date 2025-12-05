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
    const nationalChapter = searchParams.get("nationalChapter") || "";
    const internationalChapter = searchParams.get("internationalChapter") || "";
    const faculty = searchParams.get("faculty") || "";
    const department = searchParams.get("department") || "";
    const verified = searchParams.get("verified");
    const membershipFilter = searchParams.get("membershipFilter") || "members";

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

    // Build chapter filter conditions
    let chapterFilterCondition = sql``;
    if (nationalChapter) {
      chapterFilterCondition = sql` AND (c1.national_chapter = ${nationalChapter} OR c2.national_chapter = ${nationalChapter} OR c3.national_chapter = ${nationalChapter})`;
    }
    if (internationalChapter) {
      const intlFilter = sql` AND (c1.international_chapter = ${internationalChapter} OR c2.international_chapter = ${internationalChapter} OR c3.international_chapter = ${internationalChapter})`;
      chapterFilterCondition = nationalChapter ? sql`${chapterFilterCondition} ${intlFilter}` : intlFilter;
    }
    
    // Build faculty filter condition
    let facultyFilterCondition = sql``;
    if (faculty) {
      facultyFilterCondition = sql` AND a.facultyname = ${faculty}`;
    }
    
    // Build department filter condition
    let departmentFilterCondition = sql``;
    if (department) {
      departmentFilterCondition = sql` AND a.departmentname = ${department}`;
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
        assoc.title as association_title,
        assoc.description as association_description,
        assoc.dean as association_dean,
        assoc.phone as association_phone,
        assoc.email as association_email,
        assoc.address as association_address
      ${baseQuery}
      LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
      LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
      LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
      LEFT JOIN public.tbl_associations assoc ON assoc.id = a.association_id
      WHERE a.alumniid IS NOT NULL
        ${accessFilterCondition}
        ${searchCondition}
        ${chapterFilterCondition}
        ${facultyFilterCondition}
        ${departmentFilterCondition}
        ${verifiedFilterCondition}
        ${membershipWhereCondition}
      ORDER BY a.alumniid DESC
    `;

    const rows = await query;
    
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export alumni chapters data";
    console.error("[API] Export error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

