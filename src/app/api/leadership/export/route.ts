import { NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { canModify } from "@/lib/alumniProfile";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { chapterPostRoleCondition, associationPostRoleCondition } from "@/lib/leadershipRoleSql";

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
    const type = searchParams.get("type") || "all"; // "chapter", "association", "all"
    const category = searchParams.get("category") || "all"; // "all", "national", "international", "association"
    const status = searchParams.get("status") || "all"; // "all", "approved", "assessed", "pending", "rejected"
    const categoryValues = new Set(["all", "national", "international", "association"]);
    if (!categoryValues.has(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const role = searchParams.get("role") || "all"; // "all", "president", "vice_president", "coordinator"
    const search = String(searchParams.get("search") || "").trim();
    const hasAdditionalAchievements = String(searchParams.get("hasAdditionalAchievements") || "").trim();
    const faculty = String(searchParams.get("faculty") || "").trim();
    const chapter = String(searchParams.get("chapter") || "").trim();

    const toPositiveInt = (value: string | null): number => {
      if (!value) return 0;
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
    };

    const nationalChapterId = toPositiveInt(searchParams.get("nationalChapterId"));
    const internationalChapterId = toPositiveInt(searchParams.get("internationalChapterId"));
    const associationId = toPositiveInt(searchParams.get("associationId"));
    const categoryItemId = toPositiveInt(searchParams.get("categoryItemId"));

    const statusValues = new Set(["all", "approved", "assessed", "pending", "rejected"]);
    if (!statusValues.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const roleValues = new Set(["all", "president", "vice_president", "coordinator"]);
    if (!roleValues.has(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const hasAdditionalValues = new Set(["", "0", "1", "true", "false"]);
    if (!hasAdditionalValues.has(hasAdditionalAchievements.toLowerCase())) {
      return NextResponse.json({ error: "Invalid hasAdditionalAchievements" }, { status: 400 });
    }

    // Build access filter
    const accessFilter = await buildAccessFilterSQL(session, "");
    const accessFilterCondition = accessFilter.hasFilter && accessFilter.sql ? sql` AND (${accessFilter.sql})` : sql``;

    // Build status filter
    const chapterStatusCondition = status && status !== "all" ? sql` AND cl.status = ${status}` : sql``;
    const assocStatusCondition = status && status !== "all" ? sql` AND ass.status = ${status}` : sql``;

    const searchCondition = search
      ? sql` AND (
          COALESCE(a.alumniname, '') ILIKE ${`%${search}%`} OR
          COALESCE(a.sapid, '') ILIKE ${`%${search}%`} OR
          COALESCE(a.registrationno, '') ILIKE ${`%${search}%`} OR
          COALESCE(a.personalemail, '') ILIKE ${`%${search}%`} OR
          COALESCE(a.officialemail, '') ILIKE ${`%${search}%`} OR
          COALESCE(a.universityemail, '') ILIKE ${`%${search}%`}
        )`
      : sql``;

    const chapterRoleCondition =
      role === "all" ? sql`` : chapterPostRoleCondition(role as "president" | "vice_president" | "coordinator");

    const assocRoleCondition =
      role === "all" ? sql`` : associationPostRoleCondition(role as "president" | "vice_president" | "coordinator");

    const facultyCondition = faculty ? sql` AND f.faculty_name = ${faculty}` : sql``;

    const chapterMembersCondition = chapter
      ? sql` AND (
          COALESCE(c1.national_chapter, c1.international_chapter, '') ILIKE ${`%${chapter}%`} OR
          COALESCE(c2.national_chapter, c2.international_chapter, '') ILIKE ${`%${chapter}%`} OR
          COALESCE(c3.national_chapter, c3.international_chapter, '') ILIKE ${`%${chapter}%`}
        )`
      : sql``;

    const associationTitleCondition = chapter ? sql` AND COALESCE(fac.faculty_name, assoc.faculty_name, '') ILIKE ${`%${chapter}%`}` : sql``;

    const hasAdditional = hasAdditionalAchievements.toLowerCase() === "1" || hasAdditionalAchievements.toLowerCase() === "true";
    const chapterAdditionalCondition = hasAdditional
      ? sql` AND cl.additional_achievements IS NOT NULL AND LENGTH(TRIM(cl.additional_achievements)) > 0`
      : sql``;
    const assocAdditionalCondition = hasAdditional
      ? sql` AND ass.additional_achievements IS NOT NULL AND LENGTH(TRIM(ass.additional_achievements)) > 0`
      : sql``;
    const chapterCategoryCondition =
      category === "association"
        ? sql` AND 1=0`
        : category === "national"
          ? sql` AND TRIM(COALESCE(ch.national_chapter, '')) <> ''`
          : category === "international"
            ? sql` AND TRIM(COALESCE(ch.international_chapter, '')) <> ''`
            : sql``;
    const associationCategoryCondition = category === "national" || category === "international" ? sql` AND 1=0` : sql``;

    const chapterCategoryId = nationalChapterId || internationalChapterId || categoryItemId;
    const chapterCategoryIdCondition = chapterCategoryId
      ? sql` AND cl.chapter_id = ${chapterCategoryId}`
      : sql``;

    const effectiveAssociationId = associationId || (category === "association" ? categoryItemId : 0);
    const associationIdCondition = effectiveAssociationId
      ? sql` AND ass.association_id = ${effectiveAssociationId}`
      : sql``;

    const allItems: Array<Record<string, unknown>> = [];

    // Export chapter leadership
    if (type === "all" || type === "chapter") {
      const chapterRows = await sql/* sql */`
        WITH responses AS (
          SELECT
            lcc.chapter_application_id AS application_id,
            lcc.actor_type,
            lrc.label,
            lrc.sort_order,
            COALESCE(lcc.response, CASE WHEN lcc.confirmed = true THEN 'YES' ELSE 'NO' END) AS response
          FROM public.leadership_criteria_confirmations lcc
          JOIN public.leadership_role_criteria lrc ON lrc.id = lcc.criterion_id
          WHERE lcc.leadership_type = 'chapter'
            AND lcc.chapter_application_id IS NOT NULL
        ),
        alumni_criteria AS (
          SELECT
            application_id,
            STRING_AGG(label || ': ' || response, ', ' ORDER BY sort_order) AS alumni_confirmed_criteria
          FROM (
            SELECT DISTINCT application_id, label, sort_order, response
            FROM responses
            WHERE actor_type = 'alumni'
          ) d
          GROUP BY application_id
        ),
        admin_criteria AS (
          SELECT
            application_id,
            STRING_AGG(label || ': ' || response, ', ' ORDER BY sort_order) AS admin_confirmed_criteria
          FROM (
            SELECT DISTINCT application_id, label, sort_order, response
            FROM responses
            WHERE actor_type = 'admin'
          ) d
          GROUP BY application_id
        )
        SELECT
          'chapter'::text AS leadership_type,
          cl.id::bigint AS application_id,
          cl.status::text AS status,
          cl.post::text AS position,
          CASE
            WHEN ch.national_chapter IS NOT NULL AND TRIM(COALESCE(ch.national_chapter, '')) <> '' THEN 'national'
            WHEN ch.international_chapter IS NOT NULL AND TRIM(COALESCE(ch.international_chapter, '')) <> '' THEN 'international'
            ELSE NULL
          END::text AS category_type,
          COALESCE(NULLIF(TRIM(COALESCE(ch.national_chapter, '')), ''), NULLIF(TRIM(COALESCE(ch.international_chapter, '')), ''), NULL)::text AS category_name,
          cl.additional_achievements::text AS additional_achievements,
          cl.plan_strategy::text AS plan_strategy,
          cl.strategy_assessment_marks::numeric AS strategy_assessment_marks,
          cl.achievement_assessment_marks::numeric AS achievement_assessment_marks,
          cl.bonus_marks::numeric AS bonus_marks,
          cl.rejection_reason::text AS rejection_reason,
          cl.created_at::timestamptz AS created_at,
          cl.updated_at::timestamptz AS updated_at,
          a.alumniid::int AS alumniid,
          a.sapid::text AS sapid,
          a.registrationno::text AS registrationno,
          a.alumniname::text AS alumniname,
          a.personalemail::text AS personalemail,
          a.officialemail::text AS officialemail,
          a.universityemail::text AS universityemail,
          a.contactno::text AS contactno,
          a.cnicpassport::text AS cnicpassport,
          COALESCE(f.faculty_name, a.facultyname)::text AS facultyname,
          COALESCE(d.department_name, a.departmentname)::text AS departmentname,
          a.degreetitle::text AS degreetitle,
          p.program_name::text AS program_name,
          COALESCE(c1.national_chapter, c1.international_chapter)::text AS chapter1_name,
          COALESCE(c2.national_chapter, c2.international_chapter)::text AS chapter2_name,
          COALESCE(c3.national_chapter, c3.international_chapter)::text AS chapter3_name,
          assoc.faculty_name::text AS association_title,
          alumni_criteria.alumni_confirmed_criteria::text AS alumni_confirmed_criteria,
          admin_criteria.admin_confirmed_criteria::text AS admin_confirmed_criteria
        FROM public.chapter_leadership cl
        JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
        LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
        LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
        LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
        LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
        LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
        LEFT JOIN alumni_criteria ON alumni_criteria.application_id = cl.id
        LEFT JOIN admin_criteria ON admin_criteria.application_id = cl.id
        WHERE 1=1
          ${accessFilterCondition}
          ${chapterStatusCondition}
          ${searchCondition}
          ${facultyCondition}
          ${chapterMembersCondition}
          ${chapterRoleCondition}
          ${chapterAdditionalCondition}
          ${chapterCategoryCondition}
          ${chapterCategoryIdCondition}
        ORDER BY cl.created_at DESC
      `;

      chapterRows.forEach((row: Record<string, unknown>) => {
        allItems.push(row);
      });
    }

    // Export association leadership
    if (type === "all" || type === "association") {
      const associationRows = await sql/* sql */`
        WITH responses AS (
          SELECT
            lcc.association_application_id AS application_id,
            lcc.actor_type,
            lrc.label,
            lrc.sort_order,
            COALESCE(lcc.response, CASE WHEN lcc.confirmed = true THEN 'YES' ELSE 'NO' END) AS response
          FROM public.leadership_criteria_confirmations lcc
          JOIN public.leadership_role_criteria lrc ON lrc.id = lcc.criterion_id
          WHERE lcc.leadership_type = 'association'
            AND lcc.association_application_id IS NOT NULL
        ),
        alumni_criteria AS (
          SELECT
            application_id,
            STRING_AGG(label || ': ' || response, ', ' ORDER BY sort_order) AS alumni_confirmed_criteria
          FROM (
            SELECT DISTINCT application_id, label, sort_order, response
            FROM responses
            WHERE actor_type = 'alumni'
          ) d
          GROUP BY application_id
        ),
        admin_criteria AS (
          SELECT
            application_id,
            STRING_AGG(label || ': ' || response, ', ' ORDER BY sort_order) AS admin_confirmed_criteria
          FROM (
            SELECT DISTINCT application_id, label, sort_order, response
            FROM responses
            WHERE actor_type = 'admin'
          ) d
          GROUP BY application_id
        )
        SELECT
          'association'::text AS leadership_type,
          ass.id::int AS application_id,
          ass.status::text AS status,
          ass.q3::text AS position,
          'association'::text AS category_type,
          fac.faculty_name::text AS category_name,
          ass.additional_achievements::text AS additional_achievements,
          ass.plan_strategy::text AS plan_strategy,
          ass.strategy_assessment_marks::numeric AS strategy_assessment_marks,
          ass.achievement_assessment_marks::numeric AS achievement_assessment_marks,
          ass.bonus_marks::numeric AS bonus_marks,
          NULL::text AS rejection_reason,
          ass.createddatetime::timestamp without time zone AS created_at,
          NULL::timestamptz AS updated_at,
          a.alumniid::int AS alumniid,
          a.sapid::text AS sapid,
          a.registrationno::text AS registrationno,
          a.alumniname::text AS alumniname,
          a.personalemail::text AS personalemail,
          a.officialemail::text AS officialemail,
          a.universityemail::text AS universityemail,
          a.contactno::text AS contactno,
          a.cnicpassport::text AS cnicpassport,
          COALESCE(f.faculty_name, a.facultyname)::text AS facultyname,
          COALESCE(d.department_name, a.departmentname)::text AS departmentname,
          a.degreetitle::text AS degreetitle,
          p.program_name::text AS program_name,
          COALESCE(c1.national_chapter, c1.international_chapter)::text AS chapter1_name,
          COALESCE(c2.national_chapter, c2.international_chapter)::text AS chapter2_name,
          COALESCE(c3.national_chapter, c3.international_chapter)::text AS chapter3_name,
          assoc.faculty_name::text AS association_title,
          alumni_criteria.alumni_confirmed_criteria::text AS alumni_confirmed_criteria,
          admin_criteria.admin_confirmed_criteria::text AS admin_confirmed_criteria
        FROM public.tblalumniassociation ass
        JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.tbl_faculties fac ON fac.id = ass.association_id
        LEFT JOIN public.alumni_chapter ac ON ac.id = a.alumniid
        LEFT JOIN public.tblchapters c1 ON c1.id = ac.chapter1
        LEFT JOIN public.tblchapters c2 ON c2.id = ac.chapter2
        LEFT JOIN public.tblchapters c3 ON c3.id = ac.chapter3
        LEFT JOIN public.tbl_faculties assoc ON assoc.id = a.association_id
        LEFT JOIN alumni_criteria ON alumni_criteria.application_id = ass.id
        LEFT JOIN admin_criteria ON admin_criteria.application_id = ass.id
        WHERE 1=1
          ${accessFilterCondition}
          ${assocStatusCondition}
          ${searchCondition}
          ${facultyCondition}
          ${associationTitleCondition}
          ${assocRoleCondition}
          ${assocAdditionalCondition}
          ${associationCategoryCondition}
          ${associationIdCondition}
        ORDER BY ass.createddatetime DESC NULLS LAST
      `;

      associationRows.forEach((row: Record<string, unknown>) => {
        allItems.push(row);
      });
    }
    
    return NextResponse.json({ items: allItems }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export leadership data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

