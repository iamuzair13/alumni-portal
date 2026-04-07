import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";
import { buildAccessFilterSQL } from "@/lib/userAccess";
import { isAdminUser, isSuperAdminUser, isViewerUser } from "@/lib/alumniProfile";
import { publicUploadsUrlFromStored } from "@/lib/uploadsImageUrl";

function inferRoleNameFromPosition(position: string): "president" | "vice_president" | "coordinator" {
  const s = String(position || "").toLowerCase();
  if (s.includes("vice")) return "vice_president";
  if (s.includes("coordinator")) return "coordinator";
  return "president";
}

function normalizeOptionalCriteriaProficiency(raw: unknown): Record<string, number> | null {
  try {
    let obj: unknown = raw;
    if (typeof obj === "string") {
      const s = obj.trim();
      if (!s) return null;
      obj = JSON.parse(s) as unknown;
    }
    if (!obj || typeof obj !== "object") return null;

    const rec = obj as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(rec)) {
      const id = Number(k);
      const rating = Number(v);
      if (!Number.isFinite(id) || id <= 0) continue;
      if (!Number.isFinite(rating) || rating < 1) continue;
      out[String(id)] = Math.min(5, Math.max(1, Math.round(rating)));
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");
    const applicationIdRaw = searchParams.get("applicationId");

    if (type !== "chapter" && type !== "association") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const applicationId = Number(applicationIdRaw);
    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      return NextResponse.json({ error: "Invalid applicationId" }, { status: 400 });
    }

    const isSuperAdmin = isSuperAdminUser(session?.user);
    const isAdmin = isAdminUser(session?.user);
    const isViewer = isViewerUser(session?.user);
    const isStaff = isSuperAdmin || isAdmin || isViewer;
    const isAlumni = !isStaff;

    const sessionAlumniIdRaw = (session.user as { userId?: number | null })?.userId;
    const sessionAlumniId =
      sessionAlumniIdRaw && Number.isFinite(Number(sessionAlumniIdRaw)) ? Number(sessionAlumniIdRaw) : null;

    if (isAlumni && (!sessionAlumniId || sessionAlumniId <= 0)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shouldApplyFilter = !isAlumni && !isSuperAdmin && !isAdmin;
    const accessFilter = shouldApplyFilter
      ? await buildAccessFilterSQL(session, "")
      : { sql: null, hasFilter: false };

    if (type === "chapter") {
      const [hasAssessmentRemarksCol, hasAssessedByCol, hasAssessedAtCol] = await Promise.all([
        sql/* sql */`
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'chapter_leadership'
            AND column_name = 'assessment_remarks'
          LIMIT 1
        `,
        sql/* sql */`
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'chapter_leadership'
            AND column_name = 'assessed_by'
          LIMIT 1
        `,
        sql/* sql */`
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'chapter_leadership'
            AND column_name = 'assessed_at'
          LIMIT 1
        `,
      ]);

      const canSelectAssessmentFields = Boolean(hasAssessmentRemarksCol?.[0]) && Boolean(hasAssessedByCol?.[0]) && Boolean(hasAssessedAtCol?.[0]);
      const chapterAssessmentSelect = canSelectAssessmentFields
        ? sql`cl.assessment_remarks as assessment_remarks, cl.assessed_by as assessed_by, cl.assessed_at as assessed_at,`
        : sql`NULL::text as assessment_remarks, NULL::integer as assessed_by, NULL::timestamptz as assessed_at,`;

      const rows = await sql/* sql */`
        SELECT 
          cl.id as application_id,
          cl.post,
          cl.chapter_id,
          cl.status,
          cl.created_at,
          cl.updated_at,
          cl.rejection_reason,
          ${chapterAssessmentSelect}
          cl.additional_achievements,
          cl.plan_strategy,
          cl.optional_criteria_proficiency,
          cl.cv_file_url,
          cl.additional_file1_url,
          cl.additional_file2_url,
          ch.national_chapter,
          ch.international_chapter,
          a.alumniid,
          a.sapid,
          a.registrationno,
          a.alumniname,
          a.gender,
          a.contactno,
          a.officialnumber,
          a.yearofending,
          a.personalemail,
          a.officialemail,
          a.universityemail,
          f.faculty_name as facultyname,
          d.department_name as departmentname,
          p.program_name as program_name,
          a.degreetitle
        FROM public.chapter_leadership cl
        LEFT JOIN public.tbl_alumni a ON a.alumniid = cl.alumniid
        LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
        LEFT JOIN public.tbl_departments d ON d.id = a.department
        LEFT JOIN public.tbl_programs p ON p.id = a.program
        LEFT JOIN public.tblchapters ch ON ch.id = cl.chapter_id
        WHERE cl.id = ${applicationId}
          ${isAlumni && sessionAlumniId ? sql` AND cl.alumniid = ${sessionAlumniId}` : sql``}
          ${accessFilter.hasFilter && accessFilter.sql
            ? sql` AND EXISTS (
                SELECT 1 FROM public.tbl_alumni a_filter
                WHERE a_filter.alumniid = cl.alumniid
                  AND (${accessFilter.sql})
              )`
            : sql``}
        LIMIT 1
      `;

      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }

      const r = rows[0] as Record<string, unknown>;
      const position = String(r.post ?? "");
      const roleName = inferRoleNameFromPosition(position);

      const roleRows = await sql/* sql */`
        SELECT role_description, office_term_governance_html
        FROM public.leadership_roles
        WHERE leadership_type = 'chapter'
          AND role_name = ${roleName}
        LIMIT 1
      `;
      const roleRow = (roleRows?.[0] as Record<string, unknown> | undefined) ?? null;

      const criteriaRows = await sql/* sql */`
        SELECT
          c.id,
          c.label,
          c.description,
          c.is_mandatory,
          c.sort_order,
          c.criterion_score,
          c.has_textbox,
          c.textbox_label,
          c.is_textbox_required,
          (al.confirmed = true) as alumni_confirmed,
          (ad.confirmed = true) as admin_confirmed,
          COALESCE(al.response, CASE WHEN al.confirmed = true THEN 'YES' ELSE NULL END) as alumni_response,
          COALESCE(ad.response, CASE WHEN ad.confirmed = true THEN 'YES' ELSE NULL END) as admin_response,
          ad.obtained_marks as obtained_marks,
          al.text_response as alumni_text_response
        FROM public.leadership_roles lr
        JOIN public.leadership_role_criteria c ON c.role_id = lr.id
        LEFT JOIN public.leadership_criteria_confirmations al
          ON al.leadership_type = 'chapter'
         AND al.chapter_application_id = ${applicationId}
         AND al.criterion_id = c.id
         AND al.actor_type = 'alumni'
        LEFT JOIN public.leadership_criteria_confirmations ad
          ON ad.leadership_type = 'chapter'
         AND ad.chapter_application_id = ${applicationId}
         AND ad.criterion_id = c.id
         AND ad.actor_type = 'admin'
        WHERE lr.leadership_type = 'chapter'
          AND lr.role_name = ${roleName}
        ORDER BY c.sort_order ASC, c.id ASC
      `;

      const optionalCriteriaProficiency = normalizeOptionalCriteriaProficiency(r.optional_criteria_proficiency ?? null);
      const roleDescription = roleRow?.role_description ? String(roleRow.role_description) : null;
      const officeTermGovernanceHtml = roleRow?.office_term_governance_html ? String(roleRow.office_term_governance_html) : null;

      return NextResponse.json(
        {
          item: {
            type: "chapter",
            id: Number(r.application_id),
            alumniId: Number(r.alumniid),
            categoryType: r.national_chapter ? "national" : r.international_chapter ? "international" : null,
            categoryName: r.national_chapter ? String(r.national_chapter) : r.international_chapter ? String(r.international_chapter) : null,
            sapId: String(r.sapid ?? ""),
            registrationNo: r.registrationno ? String(r.registrationno) : null,
            name: String(r.alumniname ?? ""),
            gender: r.gender ? String(r.gender) : null,
            passingYear: Number.isFinite(Number(r.yearofending)) ? Number(r.yearofending) : null,
            email:
              (r.personalemail ? String(r.personalemail) : null) ||
              (r.officialemail ? String(r.officialemail) : null) ||
              (r.universityemail ? String(r.universityemail) : null) ||
              "",
            phone: (r.contactno ? String(r.contactno) : null) || (r.officialnumber ? String(r.officialnumber) : null) || null,
            faculty: r.facultyname ? String(r.facultyname) : null,
            department: r.departmentname ? String(r.departmentname) : null,
            program: r.program_name ? String(r.program_name) : (r.degreetitle ? String(r.degreetitle) : null),
            position,
            status: r.status ? String(r.status) : "pending",
            cvFileUrl: publicUploadsUrlFromStored(r.cv_file_url ? String(r.cv_file_url) : null),
            additionalFile1Url: publicUploadsUrlFromStored(r.additional_file1_url ? String(r.additional_file1_url) : null),
            additionalFile2Url: publicUploadsUrlFromStored(r.additional_file2_url ? String(r.additional_file2_url) : null),
            additionalAchievements: r.additional_achievements ? String(r.additional_achievements) : null,
            planStrategy: r.plan_strategy ? String(r.plan_strategy) : null,
            roleDescription,
            officeTermGovernanceHtml,
            optionalCriteriaProficiency,
            createdAt: r.created_at ?? null,
            updatedAt: r.updated_at ?? null,
            rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
            assessmentRemarks: r.assessment_remarks ? String(r.assessment_remarks) : null,
            assessedBy: Number.isFinite(Number(r.assessed_by)) ? Number(r.assessed_by) : null,
            assessedAt: r.assessed_at ?? null,
          },
          criteria: (criteriaRows || []).map((c: Record<string, unknown>) => ({
            id: Number(c.id),
            label: String(c.label ?? ""),
            description: c.description ? String(c.description) : null,
            is_mandatory: Boolean(c.is_mandatory),
            sort_order: Number(c.sort_order ?? 0),
            criterion_score: Number.isFinite(Number(c.criterion_score)) ? Number(c.criterion_score) : null,
              has_textbox: Boolean(c.has_textbox),
              textbox_label: c.textbox_label ? String(c.textbox_label) : null,
            alumni_confirmed: Boolean(c.alumni_confirmed),
            admin_confirmed: Boolean(c.admin_confirmed),
            alumni_response: c.alumni_response ? String(c.alumni_response) : null,
            admin_response: c.admin_response ? String(c.admin_response) : null,
              obtained_marks: Number.isFinite(Number(c.obtained_marks)) ? Number(c.obtained_marks) : null,
              alumni_text_response: c.alumni_text_response ? String(c.alumni_text_response) : null,
          })),
        },
        { status: 200 }
      );
    }

    const [hasAssocRejectionReasonCol, hasAssocAssessmentRemarksCol, hasAssocAssessedByCol, hasAssocAssessedAtCol] = await Promise.all([
      sql/* sql */`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tblalumniassociation'
          AND column_name = 'rejection_reason'
        LIMIT 1
      `,
      sql/* sql */`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tblalumniassociation'
          AND column_name = 'assessment_remarks'
        LIMIT 1
      `,
      sql/* sql */`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tblalumniassociation'
          AND column_name = 'assessed_by'
        LIMIT 1
      `,
      sql/* sql */`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tblalumniassociation'
          AND column_name = 'assessed_at'
        LIMIT 1
      `,
    ]);

    const canSelectAssocAssessmentFields =
      Boolean(hasAssocAssessmentRemarksCol?.[0]) && Boolean(hasAssocAssessedByCol?.[0]) && Boolean(hasAssocAssessedAtCol?.[0]);

    const assocAssessmentSelect = canSelectAssocAssessmentFields
      ? sql`ass.assessment_remarks as assessment_remarks, ass.assessed_by as assessed_by, ass.assessed_at as assessed_at,`
      : sql`NULL::text as assessment_remarks, NULL::integer as assessed_by, NULL::timestamp as assessed_at,`;

    const assocRejectionReasonSelect = hasAssocRejectionReasonCol?.[0]
      ? sql`ass.rejection_reason as rejection_reason,`
      : sql`NULL::text as rejection_reason,`;

    const rows = await sql/* sql */`
      SELECT 
        ass.id as application_id,
        ass.q3 as role,
        ass.association_id,
        ass.status,
        ${assocRejectionReasonSelect}
        ${assocAssessmentSelect}
        ass.createddatetime,
        ass.additional_achievements,
        ass.plan_strategy,
        ass.optional_criteria_proficiency,
        ass.cv_file_url,
        ass.additional_file1_url,
        ass.additional_file2_url,
        fac.faculty_name as association_name,
        a.alumniid,
        a.sapid,
        a.registrationno,
        a.alumniname,
        a.gender,
        a.contactno,
        a.officialnumber,
        a.yearofending,
        a.personalemail,
        a.officialemail,
        a.universityemail,
        f.faculty_name as facultyname,
        d.department_name as departmentname,
        p.program_name as program_name,
        a.degreetitle
      FROM public.tblalumniassociation ass
      LEFT JOIN public.tbl_alumni a ON a.alumniid = ass.alumni_id
      LEFT JOIN public.tbl_faculties f ON f.id = a.faculty
      LEFT JOIN public.tbl_departments d ON d.id = a.department
      LEFT JOIN public.tbl_programs p ON p.id = a.program
      LEFT JOIN public.tbl_faculties fac ON fac.id = ass.association_id
      WHERE ass.id = ${applicationId}
        ${isAlumni && sessionAlumniId ? sql` AND ass.alumni_id = ${sessionAlumniId}` : sql``}
        ${accessFilter.hasFilter && accessFilter.sql
          ? sql` AND EXISTS (
              SELECT 1 FROM public.tbl_alumni a_filter
              WHERE a_filter.alumniid = ass.alumni_id
                AND (${accessFilter.sql})
            )`
          : sql``}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const r = rows[0] as Record<string, unknown>;
    const position = String(r.role ?? "");
    const roleName = inferRoleNameFromPosition(position);

    const roleRows = await sql/* sql */`
      SELECT role_description, office_term_governance_html
      FROM public.leadership_roles
      WHERE leadership_type = 'association'
        AND role_name = ${roleName}
      LIMIT 1
    `;
    const roleRow = (roleRows?.[0] as Record<string, unknown> | undefined) ?? null;

    const criteriaRows = await sql/* sql */`
      SELECT
        c.id,
        c.label,
        c.description,
        c.is_mandatory,
        c.sort_order,
        c.criterion_score,
        c.has_textbox,
        c.textbox_label,
        c.is_textbox_required,
        (al.confirmed = true) as alumni_confirmed,
        (ad.confirmed = true) as admin_confirmed,
        COALESCE(al.response, CASE WHEN al.confirmed = true THEN 'YES' ELSE NULL END) as alumni_response,
        COALESCE(ad.response, CASE WHEN ad.confirmed = true THEN 'YES' ELSE NULL END) as admin_response,
        ad.obtained_marks as obtained_marks,
        al.text_response as alumni_text_response
      FROM public.leadership_roles lr
      JOIN public.leadership_role_criteria c ON c.role_id = lr.id
      LEFT JOIN public.leadership_criteria_confirmations al
        ON al.leadership_type = 'association'
       AND al.association_application_id = ${applicationId}
       AND al.criterion_id = c.id
       AND al.actor_type = 'alumni'
      LEFT JOIN public.leadership_criteria_confirmations ad
        ON ad.leadership_type = 'association'
       AND ad.association_application_id = ${applicationId}
       AND ad.criterion_id = c.id
       AND ad.actor_type = 'admin'
      WHERE lr.leadership_type = 'association'
        AND lr.role_name = ${roleName}
      ORDER BY c.sort_order ASC, c.id ASC
    `;

    const optionalCriteriaProficiency = normalizeOptionalCriteriaProficiency(r.optional_criteria_proficiency ?? null);
    const roleDescription = roleRow?.role_description ? String(roleRow.role_description) : null;
    const officeTermGovernanceHtml = roleRow?.office_term_governance_html ? String(roleRow.office_term_governance_html) : null;

    return NextResponse.json(
      {
        item: {
          type: "association",
          id: Number(r.application_id),
          alumniId: Number(r.alumniid),
          categoryType: "association",
          categoryName: r.association_name ? String(r.association_name) : null,
          sapId: String(r.sapid ?? ""),
          registrationNo: r.registrationno ? String(r.registrationno) : null,
          name: String(r.alumniname ?? ""),
          gender: r.gender ? String(r.gender) : null,
          passingYear: Number.isFinite(Number(r.yearofending)) ? Number(r.yearofending) : null,
          email:
            (r.personalemail ? String(r.personalemail) : null) ||
            (r.officialemail ? String(r.officialemail) : null) ||
            (r.universityemail ? String(r.universityemail) : null) ||
            "",
          phone: (r.contactno ? String(r.contactno) : null) || (r.officialnumber ? String(r.officialnumber) : null) || null,
          faculty: r.facultyname ? String(r.facultyname) : null,
          department: r.departmentname ? String(r.departmentname) : null,
          program: r.program_name ? String(r.program_name) : (r.degreetitle ? String(r.degreetitle) : null),
          position,
          status: r.status ? String(r.status) : "pending",
          cvFileUrl: publicUploadsUrlFromStored(r.cv_file_url ? String(r.cv_file_url) : null),
          additionalFile1Url: publicUploadsUrlFromStored(r.additional_file1_url ? String(r.additional_file1_url) : null),
          additionalFile2Url: publicUploadsUrlFromStored(r.additional_file2_url ? String(r.additional_file2_url) : null),
          additionalAchievements: r.additional_achievements ? String(r.additional_achievements) : null,
          planStrategy: r.plan_strategy ? String(r.plan_strategy) : null,
          roleDescription,
          officeTermGovernanceHtml,
          optionalCriteriaProficiency,
          createdAt: r.createddatetime ?? null,
          updatedAt: null,
          rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
          assessmentRemarks: r.assessment_remarks ? String(r.assessment_remarks) : null,
          assessedBy: Number.isFinite(Number(r.assessed_by)) ? Number(r.assessed_by) : null,
          assessedAt: r.assessed_at ?? null,
        },
        criteria: (criteriaRows || []).map((c: Record<string, unknown>) => ({
          id: Number(c.id),
          label: String(c.label ?? ""),
          description: c.description ? String(c.description) : null,
          is_mandatory: Boolean(c.is_mandatory),
          sort_order: Number(c.sort_order ?? 0),
          criterion_score: Number.isFinite(Number(c.criterion_score)) ? Number(c.criterion_score) : null,
        has_textbox: Boolean(c.has_textbox),
        textbox_label: c.textbox_label ? String(c.textbox_label) : null,
          alumni_confirmed: Boolean(c.alumni_confirmed),
          admin_confirmed: Boolean(c.admin_confirmed),
          alumni_response: c.alumni_response ? String(c.alumni_response) : null,
          admin_response: c.admin_response ? String(c.admin_response) : null,
          obtained_marks: Number.isFinite(Number(c.obtained_marks)) ? Number(c.obtained_marks) : null,
        alumni_text_response: c.alumni_text_response ? String(c.alumni_text_response) : null,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch application details";
    console.error("[leadership][application-details] failed", {
      message: msg,
      stack: err instanceof Error ? err.stack : undefined,
      err,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
