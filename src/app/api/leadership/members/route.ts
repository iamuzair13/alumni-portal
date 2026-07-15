import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import {
  chapterPostRoleCondition,
  associationPostRoleCondition,
} from "@/lib/leadershipRoleSql";

// Get approved leadership members
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type") || "chapter"; // "chapter" or "association"
    const search = searchParams.get("search") || "";
    const faculty = searchParams.get("faculty") || "";
    const chapter = searchParams.get("chapter") || "";
    const role = searchParams.get("role") || "all";
    const category = searchParams.get("category") || "all";
    const categoryItemId = Number(searchParams.get("categoryItemId") || "0");

    if (type !== "chapter" && type !== "association") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const roleValues = new Set(["all", "president", "vice_president", "coordinator"]);
    const categoryValues = new Set(["all", "national", "international", "association"]);

    if (!roleValues.has(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (!categoryValues.has(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const effectiveCategoryItemId = Number.isFinite(categoryItemId) && categoryItemId > 0 ? Math.trunc(categoryItemId) : 0;

    // Build access filter for admin/viewer users
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;
    
    let members: Array<{
      id: number;
      alumniId: number;
      sapId: string;
      registrationno?: string | null;
      name: string;
      email: string;
      faculty: string | null;
      department: string | null;
      program: string | null;
      position: string;
      createdAt: string;
      chapters?: string[];
      selectedByAdmin?: string | null;
      categoryName?: string | null;
    }> = [];

    if (type === "chapter") {
      // Get chapter leadership members
      const searchCondition = search ? sql` AND (
        a.alumniname ILIKE ${`%${search}%`}
        OR a.sapid ILIKE ${`%${search}%`}
        OR a.registrationno ILIKE ${`%${search}%`}
      )` : sql``;

      const facultyCondition = faculty ? sql` AND f.faculty_name = ${faculty}` : sql``;

      const roleCondition = role === "all" ? sql`` : chapterPostRoleCondition(role as "president" | "vice_president" | "coordinator");

      const categoryTypeCondition =
        category === "national"
          ? sql` AND TRIM(COALESCE(ch.national_chapter, '')) <> ''`
          : category === "international"
            ? sql` AND TRIM(COALESCE(ch.international_chapter, '')) <> ''`
            : sql``;

      const categoryItemIdCondition = effectiveCategoryItemId
        ? sql` AND cl.chapter_id = ${effectiveCategoryItemId}`
        : sql``;

      const rows = await sql/* sql */`
        WITH admin_criteria AS (
          SELECT
            lcc.chapter_application_id AS application_id,
            STRING_AGG(lrc.label || ': ' || COALESCE(lcc.response, CASE WHEN lcc.confirmed = true THEN 'YES' ELSE 'NO' END), ', ' ORDER BY lrc.sort_order) AS admin_confirmed_criteria
          FROM public.leadership_criteria_confirmations lcc
          JOIN public.leadership_role_criteria lrc ON lrc.id = lcc.criterion_id
          WHERE lcc.leadership_type = 'chapter'
            AND lcc.chapter_application_id IS NOT NULL
            AND lcc.actor_type = 'admin'
          GROUP BY lcc.chapter_application_id
        )
        SELECT
          a.alumniid,
          a.sapid,
          a.alumniname,
          d.department_name as departmentname,
          f.faculty_name as facultyname,
          p.program_name as program_name,
          a.degreetitle,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          a.registrationno,
          cl.id as leadership_id,
          cl.post,
          cl.created_at,
          COALESCE(ch.national_chapter, ch.international_chapter) as category_name,
          ac.chapter1,
          ac.chapter2,
          ac.chapter3,
          COALESCE(c1.national_chapter, c1.international_chapter) as chapter1_name,
          COALESCE(c2.national_chapter, c2.international_chapter) as chapter2_name,
          COALESCE(c3.national_chapter, c3.international_chapter) as chapter3_name,
          admin_criteria.admin_confirmed_criteria
        FROM public.tbl_alumni a
        JOIN public.chapter_leadership cl ON cl.id = a.chapter_leadership
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
        LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
        LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
        LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
        LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
        LEFT JOIN admin_criteria ON admin_criteria.application_id = cl.id
        WHERE a.chapter_leadership IS NOT NULL
          AND cl.status = 'approved'
          ${accessFilterCondition}
          ${searchCondition}
          ${facultyCondition}
          ${roleCondition}
          ${categoryTypeCondition}
          ${categoryItemIdCondition}
      `;
      
      // Process rows and filter by chapter if specified
      for (const r of rows as Array<Record<string, unknown>>) {
        const chapters: string[] = [];
        
        if (r.chapter1_name) chapters.push(String(r.chapter1_name));
        if (r.chapter2_name) chapters.push(String(r.chapter2_name));
        if (r.chapter3_name) chapters.push(String(r.chapter3_name));

        // Filter by chapter if specified
        if (chapter && chapters.length > 0 && !chapters.some(ch => ch.toLowerCase().includes(chapter.toLowerCase()))) {
          continue;
        }

        members.push({
          id: Number(r.leadership_id),
          alumniId: Number(r.alumniid),
          sapId: String(r.sapid ?? ""),
          registrationno: r.registrationno ? String(r.registrationno) : null,
          name: String(r.alumniname ?? ""),
          email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null) || "",
          faculty: r.facultyname ? String(r.facultyname) : null,
          department: r.departmentname ? String(r.departmentname) : null,
          program: r.program_name ? String(r.program_name) : (r.degreetitle ? String(r.degreetitle) : null),
          position: r.post ? String(r.post) : "",
          createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
          chapters,
          categoryName: r.category_name ? String(r.category_name) : null,
          selectedByAdmin: r.admin_confirmed_criteria ? String(r.admin_confirmed_criteria) : null,
        });
      }
    } else if (type === "association") {
      // Get association leadership members
      const searchCondition = search ? sql` AND (
        a.alumniname ILIKE ${`%${search}%`}
        OR a.sapid ILIKE ${`%${search}%`}
        OR a.registrationno ILIKE ${`%${search}%`}
      )` : sql``;

      const facultyCondition = faculty ? sql` AND f.faculty_name = ${faculty}` : sql``;

      const chapterCondition = chapter ? sql` AND assoc.faculty_name ILIKE ${`%${chapter}%`}` : sql``;

      const roleCondition = role === "all" ? sql`` : associationPostRoleCondition(role as "president" | "vice_president" | "coordinator");

      const categoryTypeCondition =
        category === "national" || category === "international"
          ? sql` AND 1=0`
          : sql``;

      const categoryItemIdCondition = effectiveCategoryItemId
        ? sql` AND ass.association_id = ${effectiveCategoryItemId}`
        : sql``;

      const rows = await sql/* sql */`
        WITH admin_criteria AS (
          SELECT
            lcc.association_application_id AS application_id,
            STRING_AGG(lrc.label || ': ' || COALESCE(lcc.response, CASE WHEN lcc.confirmed = true THEN 'YES' ELSE 'NO' END), ', ' ORDER BY lrc.sort_order) AS admin_confirmed_criteria
          FROM public.leadership_criteria_confirmations lcc
          JOIN public.leadership_role_criteria lrc ON lrc.id = lcc.criterion_id
          WHERE lcc.leadership_type = 'association'
            AND lcc.association_application_id IS NOT NULL
            AND lcc.actor_type = 'admin'
          GROUP BY lcc.association_application_id
        )
        SELECT
          a.alumniid,
          a.sapid,
          a.alumniname,
          d.department_name as departmentname,
          f.faculty_name as facultyname,
          p.program_name as program_name,
          a.degreetitle,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          a.registrationno,
          ass.id as leadership_id,
          ass.q3 as role,
          ass.createddatetime,
          COALESCE(fac.faculty_name, assoc.faculty_name) as association_title,
          COALESCE(fac.faculty_name, assoc.faculty_name) as category_name,
          admin_criteria.admin_confirmed_criteria
        FROM public.tbl_alumni a
        JOIN public.tblalumniassociation ass ON ass.id = a.association_job
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.tbl_faculties fac ON fac.id = ass.association_id
        LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
        LEFT JOIN admin_criteria ON admin_criteria.application_id = ass.id
        WHERE a.association_job IS NOT NULL
          AND ass.status = 'approved'
          ${accessFilterCondition}
          ${searchCondition}
          ${facultyCondition}
          ${chapterCondition}
          ${roleCondition}
          ${categoryTypeCondition}
          ${categoryItemIdCondition}
      `;
      
      members = rows.map((r: Record<string, unknown>) => ({
        id: Number(r.leadership_id),
        alumniId: Number(r.alumniid),
        sapId: String(r.sapid ?? ""),
        registrationno: r.registrationno ? String(r.registrationno) : null,
        name: String(r.alumniname ?? ""),
        email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null) || "",
        faculty: r.facultyname ? String(r.facultyname) : null,
        department: r.departmentname ? String(r.departmentname) : null,
        program: r.program_name ? String(r.program_name) : (r.degreetitle ? String(r.degreetitle) : null),
        position: r.role ? String(r.role) : "",
        createdAt: r.createddatetime ? new Date(r.createddatetime as string).toISOString() : new Date().toISOString(),
        categoryName: r.category_name ? String(r.category_name) : null,
        selectedByAdmin: r.admin_confirmed_criteria ? String(r.admin_confirmed_criteria) : null,
      }));
    }
    
    return NextResponse.json({ items: members }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch members";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

