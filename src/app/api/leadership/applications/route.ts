import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { isSuperAdminUser, isAdminUser, isViewerUser } from "@/lib/alumniProfile";
import { publicUploadsUrlFromStored } from "@/lib/uploadsImageUrl";

// Get all pending leadership applications
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
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
    const alumniIdParamRaw = searchParams.get("alumniId");
    const alumniIdParam = alumniIdParamRaw ? Number(alumniIdParamRaw) : null;
    const alumniId = alumniIdParam && Number.isFinite(alumniIdParam) && alumniIdParam > 0 ? alumniIdParam : null;
    const nationalChapterIdRaw = searchParams.get("nationalChapterId");
    const internationalChapterIdRaw = searchParams.get("internationalChapterId");
    const associationIdRaw = searchParams.get("associationId");
    const nationalChapterId = nationalChapterIdRaw ? Number(nationalChapterIdRaw) : null;
    const internationalChapterId = internationalChapterIdRaw ? Number(internationalChapterIdRaw) : null;
    const associationId = associationIdRaw ? Number(associationIdRaw) : null;
    const validNationalChapterId =
      nationalChapterId && Number.isFinite(nationalChapterId) && nationalChapterId > 0 ? nationalChapterId : null;
    const validInternationalChapterId =
      internationalChapterId && Number.isFinite(internationalChapterId) && internationalChapterId > 0 ? internationalChapterId : null;
    const validAssociationId = associationId && Number.isFinite(associationId) && associationId > 0 ? associationId : null;

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
    
    // Build access filter for admin/viewer users
    // For leadership applications, super admins and admins should see ALL applications
    // Viewers can view but with access filter applied
    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isAdmin = isAdminUser(session?.user);
    const isViewer = isViewerUser(session?.user);
    const isStaff = isSuperAdmin || isAdmin || isViewer;

    const sessionAlumniId = (session.user as { userId?: number | null })?.userId ? Number((session.user as { userId?: number | null }).userId) : null;
    const isAlumni = !isStaff;
    if (isAlumni) {
      if (!sessionAlumniId || !Number.isFinite(sessionAlumniId) || sessionAlumniId <= 0) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (alumniId && alumniId !== sessionAlumniId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (search) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    
    // Super admins and admins see all applications (no filter)
    // Viewers get filtered by their access assignments
    // Alumni should never get staff access filters applied
    const shouldApplyFilter = !isAlumni && !isSuperAdmin && !isAdmin;
    const accessFilter = shouldApplyFilter
      ? await buildAccessFilterSQL(session, "")
      : { sql: null, hasFilter: false };

    if (process.env.NODE_ENV !== "production") {
      console.info("[leadership][applications] request", {
        isAlumni,
        isViewer,
        isAdmin,
        isSuperAdmin,
        sessionAlumniId,
        requestedAlumniId: alumniId,
        effectiveAlumniId: isAlumni ? sessionAlumniId : alumniId,
        type,
        status,
        role,
        search: search ? "(provided)" : "",
        applyAccessFilter: shouldApplyFilter,
        accessFilterHas: accessFilter.hasFilter,
      });
    }

    const applications: Array<{
      id: number;
      alumniId: number;
      sapId: string;
      registrationno?: string | null;
      name: string;
      email: string;
      faculty: string | null;
      department: string | null;
      program: string | null;
      type: "chapter" | "association";
      position: string;
      status: string;
      categoryType?: "national" | "international" | "association" | null;
      categoryName?: string | null;
      additionalAchievements?: string | null;
      cvFileUrl?: string | null;
      additionalFile1Url?: string | null;
      additionalFile2Url?: string | null;
      createdAt: string;
      obtainedMarksTotal?: number | null;
      bonusMarks?: number | null;
    }> = [];

    const statusCondition = status !== "all" ? sql` AND cl.status = ${status}` : sql``;
    const assocStatusCondition = status !== "all" ? sql` AND ass.status = ${status}` : sql``;

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

    const normalizeRoleExpr = (columnExpr: any) =>
      // lower + trim + remove all non-letters, so "Vice President" -> "vicepresident" and "President" -> "president"
      sql`LOWER(REGEXP_REPLACE(TRIM(COALESCE(${columnExpr}, '')), '[^a-z]+', '', 'g'))`;

    const roleMatchValuesChapter =
      role === "vice_president"
        ? ["vicepresident", "chaptervicepresident"]
        : role === "coordinator"
          ? ["coordinator", "chaptercoordinator"]
          : role === "president"
            ? ["president", "chapterpresident"]
            : null;

    const roleMatchValuesAssoc =
      role === "vice_president" ? ["vicepresident"] : role === "coordinator" ? ["coordinator"] : role === "president" ? ["president"] : null;

    const chapterRoleCondition = (() => {
      if (role === "all" || !roleMatchValuesChapter || roleMatchValuesChapter.length === 0) return sql``;

      const normalized = normalizeRoleExpr(sql`cl.post`);
      if (roleMatchValuesChapter.length === 1) return sql` AND (${normalized} = ${roleMatchValuesChapter[0]})`;
      return sql` AND (${normalized} = ${roleMatchValuesChapter[0]} OR ${normalized} = ${roleMatchValuesChapter[1]})`;
    })();

    const assocRoleCondition = (() => {
      if (role === "all" || !roleMatchValuesAssoc || roleMatchValuesAssoc.length === 0) return sql``;

      const normalized = normalizeRoleExpr(sql`ass.q3`);
      return sql` AND (${normalized} = ${roleMatchValuesAssoc[0]})`;
    })();

    const hasAdditional = hasAdditionalAchievements.toLowerCase() === "1" || hasAdditionalAchievements.toLowerCase() === "true";
    const chapterAdditionalCondition = hasAdditional
      ? sql` AND cl.additional_achievements IS NOT NULL AND LENGTH(TRIM(cl.additional_achievements)) > 0`
      : sql``;
    const assocAdditionalCondition = hasAdditional
      ? sql` AND ass.additional_achievements IS NOT NULL AND LENGTH(TRIM(ass.additional_achievements)) > 0`
      : sql``;

    const effectiveAlumniId = isAlumni ? sessionAlumniId : alumniId;
    const chapterAlumniFilter = effectiveAlumniId ? sql` AND cl.alumniid = ${Number(effectiveAlumniId)}` : sql``;
    const assocAlumniFilter = effectiveAlumniId ? sql` AND ass.alumni_id = ${Number(effectiveAlumniId)}` : sql``;
    const chapterCategoryCondition =
      category === "association"
        ? sql` AND 1=0`
        : category === "national"
          ? sql` AND TRIM(COALESCE(ch.national_chapter, '')) <> ''`
          : category === "international"
            ? sql` AND TRIM(COALESCE(ch.international_chapter, '')) <> ''`
            : sql``;
    const associationCategoryCondition = category === "national" || category === "international" ? sql` AND 1=0` : sql``;

    const chapterDimensionCondition = validAssociationId
      ? sql` AND 1=0`
      : sql`
          ${validNationalChapterId ? sql` AND cl.chapter_id = ${validNationalChapterId} AND TRIM(COALESCE(ch.national_chapter, '')) <> ''` : sql``}
          ${validInternationalChapterId ? sql` AND cl.chapter_id = ${validInternationalChapterId} AND TRIM(COALESCE(ch.international_chapter, '')) <> ''` : sql``}
        `;
    const associationDimensionCondition =
      validNationalChapterId || validInternationalChapterId
        ? sql` AND 1=0`
        : validAssociationId
          ? sql` AND ass.association_id = ${validAssociationId}`
          : sql``;

    // Get chapter leadership applications
    if (type === "all" || type === "chapter") {
      // Get all pending applications - join with tbl_alumni using alumni_id
      const chapterRows = await sql/* sql */`
        SELECT 
          cl.id as leadership_id,
          cl.post,
          cl.chapter_id,
          cl.created_at,
          cl.status,
          cl.additional_achievements,
          cl.cv_file_url,
          cl.additional_file1_url,
          cl.additional_file2_url,
          ch.national_chapter,
          ch.international_chapter,
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
          (
            SELECT SUM(lcc.obtained_marks)
            FROM public.leadership_criteria_confirmations lcc
            WHERE lcc.leadership_type = 'chapter'
              AND lcc.chapter_application_id = cl.id
              AND lcc.actor_type = 'admin'
          ) AS total_obtained_marks
          , cl.bonus_marks
        FROM public.chapter_leadership cl
        LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
        WHERE 1=1
          ${statusCondition}
          ${searchCondition}
          ${chapterRoleCondition}
          ${chapterAdditionalCondition}
          ${chapterAlumniFilter}
          ${chapterCategoryCondition}
          ${chapterDimensionCondition}
          ${accessFilter.hasFilter && accessFilter.sql 
            ? sql` AND EXISTS (
                SELECT 1 FROM public.tbl_alumni a_filter 
                WHERE a_filter.alumniid = cl.alumniid 
                AND (${accessFilter.sql})
              )`
            : sql``}
        ORDER BY cl.created_at DESC NULLS LAST
      `;

      if (process.env.NODE_ENV !== "production") {
        console.info("[leadership][applications] chapter rows", { count: Array.isArray(chapterRows) ? chapterRows.length : 0 });
      }

      chapterRows.forEach((r: Record<string, unknown>) => {
        const national = r.national_chapter ? String(r.national_chapter) : "";
        const international = r.international_chapter ? String(r.international_chapter) : "";
        const chapterCategoryType = national ? "national" : international ? "international" : null;
        const chapterCategoryName = national || international || null;
        applications.push({
          id: Number(r.leadership_id),
          alumniId: Number(r.alumniid),
          sapId: String(r.sapid ?? ""),
          registrationno: r.registrationno ? String(r.registrationno) : null,
          name: String(r.alumniname ?? ""),
          email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null) || "",
          faculty: r.facultyname ? String(r.facultyname) : null,
          department: r.departmentname ? String(r.departmentname) : null,
          program: r.program_name ? String(r.program_name) : (r.degreetitle ? String(r.degreetitle) : null),
          type: "chapter",
          position: r.post ? String(r.post) : "",
          status: r.status ? String(r.status) : "",
          categoryType: chapterCategoryType,
          categoryName: chapterCategoryName,
          additionalAchievements: r.additional_achievements ? String(r.additional_achievements) : null,
          cvFileUrl: publicUploadsUrlFromStored(r.cv_file_url ? String(r.cv_file_url) : null),
          additionalFile1Url: publicUploadsUrlFromStored(r.additional_file1_url ? String(r.additional_file1_url) : null),
          additionalFile2Url: publicUploadsUrlFromStored(r.additional_file2_url ? String(r.additional_file2_url) : null),
          createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
          obtainedMarksTotal: (() => {
            const v = r.total_obtained_marks;
            if (v == null || v === "") return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          })(),
          bonusMarks: (() => {
            const n = Number(r.bonus_marks);
            return Number.isFinite(n) ? n : 0;
          })(),
        });
      });
    }

    // Get association leadership applications
    if (type === "all" || type === "association") {
      const associationRows = await sql/* sql */`
        SELECT 
          ass.id as leadership_id,
          ass.q3 as role,
          ass.association_id,
          ass.createddatetime,
          ass.status,
          ass.additional_achievements,
          ass.cv_file_url,
          ass.additional_file1_url,
          ass.additional_file2_url,
          fac.faculty_name as association_name,
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
          (
            SELECT SUM(lcc.obtained_marks)
            FROM public.leadership_criteria_confirmations lcc
            WHERE lcc.leadership_type = 'association'
              AND lcc.association_application_id = ass.id
              AND lcc.actor_type = 'admin'
          ) AS total_obtained_marks
          , ass.bonus_marks
        FROM public.tblalumniassociation ass
        LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.tbl_faculties fac ON fac.id = ass.association_id
        WHERE 1=1
          ${assocStatusCondition}
          ${searchCondition}
          ${assocRoleCondition}
          ${assocAdditionalCondition}
          ${assocAlumniFilter}
          ${associationCategoryCondition}
          ${associationDimensionCondition}
          ${accessFilter.hasFilter && accessFilter.sql 
            ? sql` AND EXISTS (
                SELECT 1 FROM public.tbl_alumni a_filter 
                WHERE a_filter.alumniid = ass.alumni_id 
                AND (${accessFilter.sql})
              )`
            : sql``}
        ORDER BY ass.createddatetime DESC NULLS LAST
      `;

      if (process.env.NODE_ENV !== "production") {
        console.info("[leadership][applications] association rows", { count: Array.isArray(associationRows) ? associationRows.length : 0 });
      }

      associationRows.forEach((r: Record<string, unknown>) => {
        const assocName = r.association_name ? String(r.association_name) : null;
        applications.push({
          id: Number(r.leadership_id),
          alumniId: Number(r.alumniid),
          sapId: String(r.sapid ?? ""),
          registrationno: r.registrationno ? String(r.registrationno) : null,
          name: String(r.alumniname ?? ""),
          email: (r.personalemail ? String(r.personalemail) : null) || (r.officialemail ? String(r.officialemail) : null) || (r.universityemail ? String(r.universityemail) : null) || "",
          faculty: r.facultyname ? String(r.facultyname) : null,
          department: r.departmentname ? String(r.departmentname) : null,
          program: r.program_name ? String(r.program_name) : (r.degreetitle ? String(r.degreetitle) : null),
          type: "association",
          position: r.role ? String(r.role) : "",
          status: r.status ? String(r.status) : "",
          categoryType: "association",
          categoryName: assocName,
          additionalAchievements: r.additional_achievements ? String(r.additional_achievements) : null,
          cvFileUrl: publicUploadsUrlFromStored(r.cv_file_url ? String(r.cv_file_url) : null),
          additionalFile1Url: publicUploadsUrlFromStored(r.additional_file1_url ? String(r.additional_file1_url) : null),
          additionalFile2Url: publicUploadsUrlFromStored(r.additional_file2_url ? String(r.additional_file2_url) : null),
          createdAt: r.createddatetime ? new Date(r.createddatetime as string).toISOString() : new Date().toISOString(),
          obtainedMarksTotal: (() => {
            const v = r.total_obtained_marks;
            if (v == null || v === "") return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          })(),
          bonusMarks: (() => {
            const n = Number(r.bonus_marks);
            return Number.isFinite(n) ? n : 0;
          })(),
        });
      });
    }

    // Sort by created date (newest first)
    applications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ items: applications }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch applications";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

