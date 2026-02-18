import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { isSuperAdminUser, isAdminUser, isViewerUser } from "@/lib/alumniProfile";

// Get all pending leadership applications
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type") || "all"; // "chapter", "association", "all"
    const status = searchParams.get("status") || "pending"; // "all", "approved", "pending", "rejected"
    const role = searchParams.get("role") || "all"; // "all", "president", "vice_president", "coordinator"
    const search = String(searchParams.get("search") || "").trim();
    const hasAdditionalAchievements = String(searchParams.get("hasAdditionalAchievements") || "").trim();
    const alumniIdParamRaw = searchParams.get("alumniId");
    const alumniIdParam = alumniIdParamRaw ? Number(alumniIdParamRaw) : null;
    const alumniId = alumniIdParam && Number.isFinite(alumniIdParam) && alumniIdParam > 0 ? alumniIdParam : null;

    const statusValues = new Set(["all", "approved", "pending", "rejected"]);
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
      additionalAchievements?: string | null;
      createdAt: string;
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

    const chapterRoleCondition =
      role === "all"
        ? sql``
        : role === "vice_president"
          ? sql` AND cl.post ILIKE '%Vice%'`
          : role === "coordinator"
            ? sql` AND cl.post ILIKE '%Coordinator%'`
            : sql` AND cl.post ILIKE '%President%'`;

    const assocRoleCondition =
      role === "all"
        ? sql``
        : role === "vice_president"
          ? sql` AND ass.q3 ILIKE '%Vice%'`
          : role === "coordinator"
            ? sql` AND ass.q3 ILIKE '%Coordinator%'`
            : sql` AND ass.q3 ILIKE '%President%'`;

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

    // Get chapter leadership applications
    if (type === "all" || type === "chapter") {
      // Get all pending applications - join with tbl_alumni using alumni_id
      const chapterRows = await sql/* sql */`
        SELECT 
          cl.id as leadership_id,
          cl.post,
          cl.created_at,
          cl.status,
          cl.additional_achievements,
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
          a.registrationno
        FROM public.chapter_leadership cl
        LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE 1=1
          ${statusCondition}
          ${searchCondition}
          ${chapterRoleCondition}
          ${chapterAdditionalCondition}
          ${chapterAlumniFilter}
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
          additionalAchievements: r.additional_achievements ? String(r.additional_achievements) : null,
          createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
        });
      });
    }

    // Get association leadership applications
    if (type === "all" || type === "association") {
      const associationRows = await sql/* sql */`
        SELECT 
          ass.id as leadership_id,
          ass.q3 as role,
          ass.createddatetime,
          ass.status,
          ass.additional_achievements,
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
          a.registrationno
        FROM public.tblalumniassociation ass
        LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        WHERE 1=1
          ${assocStatusCondition}
          ${searchCondition}
          ${assocRoleCondition}
          ${assocAdditionalCondition}
          ${assocAlumniFilter}
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
          additionalAchievements: r.additional_achievements ? String(r.additional_achievements) : null,
          createdAt: r.createddatetime ? new Date(r.createddatetime as string).toISOString() : new Date().toISOString(),
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

